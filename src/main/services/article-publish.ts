import fs from 'node:fs'
import { launchEdge, isEdgeDebugging } from '../edge-launcher'
import { convertMarkdownToZhihuHtml } from './zhihu-markdown'
import { CdpConnection, openPageSession, sleep } from '../../../scripts/vendor/baoyu-chrome-cdp/src/index'

export interface PublishArticleOptions {
  markdownPath: string
  autoSubmit: boolean
  onLog?: (line: string) => void
}

const ZHIHU_WRITE_URL = 'https://zhuanlan.zhihu.com/write'
const CDP_PORT = 9222

function emitStep(onLog: PublishArticleOptions['onLog'], step: number, label: string): void {
  onLog?.(`__STEP__publish:${step}:${label}`)
}

function emitLog(onLog: PublishArticleOptions['onLog'], message: string): void {
  onLog?.(message)
}

async function getWebSocketDebuggerUrl(): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
  if (!response.ok) {
    throw new Error('无法连接 Edge 调试端口')
  }

  const data = await response.json() as { webSocketDebuggerUrl?: string }
  if (!data.webSocketDebuggerUrl) {
    throw new Error('未获取到 Edge 调试 WebSocket 地址')
  }

  return data.webSocketDebuggerUrl
}

async function runtimeEvaluate<T>(
  cdp: CdpConnection,
  sessionId: string,
  expression: string,
): Promise<T> {
  const result = await cdp.send<{ result?: { value?: T } }>(
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
    },
    { sessionId },
  )

  return result.result?.value as T
}

async function waitForEditor(cdp: CdpConnection, sessionId: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const ready = await runtimeEvaluate<boolean>(
      cdp,
      sessionId,
      `(() => {
        const titleEl = document.querySelector('textarea[placeholder*="标题"], input[placeholder*="标题"], textarea, input[type="text"]');
        const bodyEl = document.querySelector('[contenteditable="true"], .ProseMirror, .public-DraftEditor-content, [role="textbox"]');
        return Boolean(titleEl && bodyEl);
      })()`
    )

    if (ready) {
      return
    }

    await sleep(500)
  }

  throw new Error('知乎编辑器未就绪，请确认已登录知乎且页面已成功打开')
}

async function fillEditor(cdp: CdpConnection, sessionId: string, title: string, bodyHtml: string): Promise<void> {
  const script = `(() => {
    const titleValue = ${JSON.stringify(title)};
    const bodyValue = ${JSON.stringify(bodyHtml)};

    function pickBodyElement() {
      return document.querySelector('.ProseMirror')
        || document.querySelector('.public-DraftEditor-content [contenteditable="true"]')
        || document.querySelector('[contenteditable="true"]')
        || document.querySelector('[role="textbox"]');
    }

    function setInputValue(element, nextValue) {
      const prototype = Object.getPrototypeOf(element);
      const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
      if (descriptor && typeof descriptor.set === 'function') {
        descriptor.set.call(element, nextValue);
      } else {
        element.value = nextValue;
      }
    }

    function buildPlainTextFromHtml(html) {
      const container = document.createElement('div');
      container.innerHTML = html;
      return (container.innerText || container.textContent || '').trim();
    }

    function dispatchPaste(element, html) {
      const plainText = buildPlainTextFromHtml(html);
      const data = new DataTransfer();
      data.setData('text/html', html);
      data.setData('text/plain', plainText);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
      });

      try {
        Object.defineProperty(pasteEvent, 'clipboardData', {
          value: data,
        });
      } catch {}

      return element.dispatchEvent(pasteEvent);
    }

    const titleEl = document.querySelector('textarea[placeholder*="标题"], input[placeholder*="标题"], textarea, input[type="text"]');
    const bodyEl = pickBodyElement();

    if (!titleEl || !bodyEl) {
      return { ok: false, reason: '未找到标题或正文编辑器' };
    }

    titleEl.focus();
    if ('value' in titleEl) {
      setInputValue(titleEl, titleValue);
    }
    titleEl.dispatchEvent(new Event('input', { bubbles: true }));
    titleEl.dispatchEvent(new Event('change', { bubbles: true }));

    bodyEl.focus();

    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(bodyEl);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    document.execCommand('selectAll', false);

    const beforeHtml = (bodyEl.innerHTML || '').trim();
    const pasteDispatched = dispatchPaste(bodyEl, bodyValue);
    const afterPasteHtml = (bodyEl.innerHTML || '').trim();

    if (!pasteDispatched || afterPasteHtml === beforeHtml || afterPasteHtml.length === 0) {
      document.execCommand('insertHTML', false, bodyValue);
    }

    if ((bodyEl.innerHTML || '').trim().length === 0) {
      bodyEl.innerHTML = bodyValue;
    }

    bodyEl.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: null }));
    bodyEl.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  })()`

  const result = await runtimeEvaluate<{ ok: boolean; reason?: string }>(cdp, sessionId, script)
  if (!result?.ok) {
    throw new Error(result?.reason || '正文填充失败')
  }
}

async function clickPublishButton(cdp: CdpConnection, sessionId: string): Promise<void> {
  const result = await runtimeEvaluate<{ ok: boolean; reason?: string }>(
    cdp,
    sessionId,
    `(() => {
      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
      const publishButton = candidates.find((element) => {
        const text = (element.textContent || '').trim();
        const disabled = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
        return !disabled && (text === '发布' || text.includes('发布'));
      });

      if (!publishButton) {
        return { ok: false, reason: '未找到发布按钮' };
      }

      publishButton.click();
      return { ok: true };
    })()`
  )

  if (!result?.ok) {
    throw new Error(result?.reason || '自动发布失败')
  }
}

export async function publishArticle(options: PublishArticleOptions): Promise<{ status: 'filled' | 'published' }> {
  let markdownFile = options.markdownPath

  emitStep(options.onLog, 1, '打开知乎编辑器')
  emitLog(options.onLog, '▶ 步骤 1: 启动 Edge 浏览器（CDP 调试模式）')
  if (!(await isEdgeDebugging())) {
    const launchResult = await launchEdge()
    if (!launchResult.success) {
      throw new Error(launchResult.error || 'Edge 启动失败')
    }
  }

  emitStep(options.onLog, 2, '填充文章内容')
  emitLog(options.onLog, '▶ 步骤 2: 转换 Markdown 为 HTML')

  const stat = fs.statSync(markdownFile)
  if (stat.isDirectory()) {
    const files = fs.readdirSync(markdownFile).filter((file) => file.endsWith('.md'))
    if (files.length === 0) {
      throw new Error('目录中没有找到 .md 文件')
    }
    markdownFile = `${markdownFile}/${files[0]}`
  }

  const conversion = await convertMarkdownToZhihuHtml(markdownFile)
  emitLog(options.onLog, '✓ Markdown 转换完成')
  emitLog(options.onLog, `✓ 标题: ${conversion.title}`)
  emitLog(options.onLog, `✓ 话题: ${conversion.topics.join(', ')}`)

  emitStep(options.onLog, 3, '等待页面就绪')
  emitLog(options.onLog, '▶ 步骤 3: 填充标题和正文到知乎编辑器')

  const wsUrl = await getWebSocketDebuggerUrl()
  const cdp = await CdpConnection.connect(wsUrl, 10_000)

  try {
    const page = await openPageSession({
      cdp,
      reusing: false,
      url: ZHIHU_WRITE_URL,
      matchTarget: (target) => target.url.startsWith(ZHIHU_WRITE_URL),
      enablePage: true,
      enableRuntime: true,
      activateTarget: true,
    })

    await cdp.send('Page.navigate', { url: ZHIHU_WRITE_URL }, { sessionId: page.sessionId })
    await sleep(4_000)
    await waitForEditor(cdp, page.sessionId)
    await fillEditor(cdp, page.sessionId, conversion.title, conversion.bodyHtml)

    emitStep(options.onLog, 4, '完成')
    emitLog(options.onLog, '▶ 步骤 4: 发布完成')
    emitLog(options.onLog, '')
    emitLog(options.onLog, '========== 发布报告 ==========')
    emitLog(options.onLog, `文件: ${markdownFile}`)
    emitLog(options.onLog, `标题: ${conversion.title}`)
    emitLog(options.onLog, `话题: ${conversion.topics.join(', ')}`)
    emitLog(options.onLog, '')
    emitLog(options.onLog, '✓ 文章已填充到知乎编辑器')
    emitLog(options.onLog, '')

    if (options.autoSubmit) {
      await clickPublishButton(cdp, page.sessionId)
      emitLog(options.onLog, '✓ 文章已自动发布')
      emitLog(options.onLog, '==========================================')
      return { status: 'published' }
    }

    emitLog(options.onLog, '⚠ 请在浏览器中检查后手动点击「发布」')
    emitLog(options.onLog, '==========================================')
    emitLog(options.onLog, '')
    emitLog(options.onLog, '💡 浏览器已保持打开状态，请完成发布后关闭')
    return { status: 'filled' }
  } finally {
    cdp.close()
  }
}