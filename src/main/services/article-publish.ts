import fs from 'node:fs'
import { launchEdge, isEdgeDebugging, restartEdge } from '../edge-launcher'
import { convertMarkdownToZhihuHtml } from './zhihu-markdown'
import { CdpConnection, openPageSession, sleep } from '../../../scripts/vendor/baoyu-chrome-cdp/src/index'
import { createTaskError, type TaskReporter } from './task-runtime'

export interface PublishArticleOptions {
  markdownPath: string
  autoSubmit: boolean
  reporter?: TaskReporter
}

export interface ZhihuLoginState {
  edgeReady: boolean
  loggedIn: boolean
  displayName?: string
  currentUrl?: string
  reason?: string
}

const ZHIHU_WRITE_URL = 'https://zhuanlan.zhihu.com/write'
const ZHIHU_HOME_URL = 'https://www.zhihu.com/'
const CDP_PORT = 9222

interface ChromeTargetInfo {
  targetId: string
  url: string
  type: string
}

interface CookieInfo {
  name: string
  value?: string
  domain?: string
}

function emitStep(reporter: TaskReporter | undefined, step: number, label: string): void {
  reporter?.emitStep(step, 4, label)
}

function emitLog(reporter: TaskReporter | undefined, level: 'info' | 'success' | 'warning' | 'error', message: string, important = true): void {
  reporter?.emitLog(level, message, important)
}

async function getWebSocketDebuggerUrl(): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
  if (!response.ok) {
    throw createTaskError({
      code: 'EDGE_DEBUG_PORT_UNAVAILABLE',
      task: 'publish',
      userMessage: '无法连接 Edge 调试端口',
      retryable: true,
    })
  }

  const data = await response.json() as { webSocketDebuggerUrl?: string }
  if (!data.webSocketDebuggerUrl) {
    throw createTaskError({
      code: 'EDGE_DEBUG_WS_MISSING',
      task: 'publish',
      userMessage: '未获取到 Edge 调试 WebSocket 地址',
      retryable: true,
    })
  }

  return data.webSocketDebuggerUrl
}

async function runtimeEvaluate<T>(
  cdp: CdpConnection,
  sessionId: string,
  expression: string,
): Promise<T | undefined> {
  const result = await cdp.send<{ result?: { value?: T }; exceptionDetails?: { text?: string } }>(
    'Runtime.evaluate',
    {
      expression,
      returnByValue: true,
      awaitPromise: true,
    },
    { sessionId },
  )

  if (result.exceptionDetails) {
    return undefined
  }

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

  throw createTaskError({
    code: 'ZHIHU_EDITOR_NOT_READY',
    task: 'publish',
    userMessage: '知乎编辑器未就绪，请确认已登录知乎且页面已成功打开',
    retryable: true,
  })
}

async function detachSession(cdp: CdpConnection, sessionId: string): Promise<void> {
  try {
    await cdp.send('Target.detachFromTarget', { sessionId })
  } catch {
    // Ignore detach failures, session may already be gone.
  }
}

function isInspectablePageTarget(target: ChromeTargetInfo): boolean {
  return target.type === 'page'
    && !target.url.startsWith('devtools://')
    && !target.url.startsWith('edge://')
    && !target.url.startsWith('chrome://')
    && (target.url === '' || target.url === 'about:blank' || /^https?:\/\//.test(target.url))
}

function isZhihuTarget(target: ChromeTargetInfo): boolean {
  return /https?:\/\/(?:[^/]+\.)?zhihu\.com\//.test(target.url)
}

async function attachDetectionSession(cdp: CdpConnection): Promise<{
  sessionId: string
  targetId: string
  currentUrl?: string
} | null> {
  const result = await cdp.send<{ targetInfos: ChromeTargetInfo[] }>('Target.getTargets')
  const candidates = result.targetInfos.filter(isInspectablePageTarget)
  const preferred = candidates.find(isZhihuTarget) ?? candidates[0]

  if (!preferred) {
    return null
  }

  const { sessionId } = await cdp.send<{ sessionId: string }>('Target.attachToTarget', {
    targetId: preferred.targetId,
    flatten: true,
  })

  await cdp.send('Runtime.enable', {}, { sessionId })
  await cdp.send('Network.enable', {}, { sessionId })

  return {
    sessionId,
    targetId: preferred.targetId,
    currentUrl: preferred.url || undefined,
  }
}

async function getZhihuAuthCookies(cdp: CdpConnection, sessionId: string): Promise<CookieInfo[]> {
  const result = await cdp.send<{ cookies?: CookieInfo[] }>(
    'Network.getCookies',
    { urls: [ZHIHU_HOME_URL, ZHIHU_WRITE_URL] },
    { sessionId },
  )

  return result.cookies ?? []
}

function hasZhihuLoginCookie(cookies: CookieInfo[]): boolean {
  return cookies.some((cookie) => {
    const domain = cookie.domain || ''
    return domain.includes('zhihu.com')
      && (cookie.name === 'z_c0' || cookie.name === 'd_c0')
      && Boolean(cookie.value)
  })
}

export async function getZhihuLoginState(): Promise<ZhihuLoginState> {
  if (!(await isEdgeDebugging())) {
    return {
      edgeReady: false,
      loggedIn: false,
      reason: 'Edge 未连接，无法检测知乎登录状态',
    }
  }

  const wsUrl = await getWebSocketDebuggerUrl()
  const cdp = await CdpConnection.connect(wsUrl, 10_000)

  try {
    const session = await attachDetectionSession(cdp)

    if (!session) {
      return {
        edgeReady: true,
        loggedIn: false,
        reason: '未找到可检测的 Edge 页签，请先在 Edge 中打开任意页面后重试',
      }
    }

    try {
      const cookies = await getZhihuAuthCookies(cdp, session.sessionId)
      const hasLoginCookie = hasZhihuLoginCookie(cookies)

      const state = await runtimeEvaluate<ZhihuLoginState>(
        cdp,
        session.sessionId,
        `(() => {
          const currentUrl = location.href;
          const displayName = (
            document.querySelector('[data-testid="AppHeader-profile"]')?.textContent
            || document.querySelector('a[href*="/people/"]')?.textContent
            || document.querySelector('.AppHeader-profileEntry-name')?.textContent
            || ''
          ).trim();
          const redirectedToSignin = /zhihu\.com\/(signin|signup)/.test(currentUrl);
          const hasProfileEntry = Boolean(
            document.querySelector('[data-testid="AppHeader-profile"]')
            || document.querySelector('a[href*="/people/"]')
            || document.querySelector('.AppHeader-profileEntry-name')
          );

          return {
            edgeReady: true,
            loggedIn: !redirectedToSignin && hasProfileEntry,
            displayName: displayName || undefined,
            currentUrl,
            reason: undefined,
          };
        })()`
      )

      const resolvedState: ZhihuLoginState = state ?? {
        edgeReady: true,
        loggedIn: false,
        currentUrl: session.currentUrl,
        reason: '当前 Edge 页签暂时无法读取知乎登录状态，请切到知乎页面后重试',
      }

      const loggedIn = hasLoginCookie || resolvedState.loggedIn

      return {
        edgeReady: true,
        loggedIn,
        displayName: resolvedState.displayName,
        currentUrl: resolvedState.currentUrl || session.currentUrl,
        reason: loggedIn ? undefined : resolvedState.reason || '未检测到知乎有效登录态，请先在 Edge 中重新登录知乎',
      }
    } finally {
      await detachSession(cdp, session.sessionId)
    }
  } finally {
    cdp.close()
  }
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
    throw createTaskError({
      code: 'ZHIHU_FILL_FAILED',
      task: 'publish',
      userMessage: result?.reason || '正文填充失败',
      retryable: true,
    })
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
    throw createTaskError({
      code: 'ZHIHU_AUTO_SUBMIT_FAILED',
      task: 'publish',
      userMessage: result?.reason || '自动发布失败',
      retryable: true,
    })
  }
}

async function testEdgeProcess(): Promise<boolean> {
  try {
    const wsUrl = await getWebSocketDebuggerUrl()
    const cdp = await CdpConnection.connect(wsUrl, 2_000)
    cdp.close()
    return true
  } catch {
    return false
  }
}

async function ensureEdgeReady(reporter?: TaskReporter): Promise<void> {
  const debugging = await isEdgeDebugging()

  if (debugging) {
    const alive = await testEdgeProcess()
    if (alive) return
    emitLog(reporter, 'warning', 'Edge 调试端口无响应，正在自动重启 Edge...')
    const result = await restartEdge()
    if (!result.success) {
      throw createTaskError({
        code: 'EDGE_LAUNCH_FAILED',
        task: 'publish',
        userMessage: result.error || 'Edge 重启失败',
        retryable: true,
      })
    }
    return
  }

  const launchResult = await launchEdge()
  if (launchResult.success) return

  emitLog(reporter, 'warning', '首次启动失败，正在清理残留进程后重试...')
  const retryResult = await restartEdge()
  if (!retryResult.success) {
    throw createTaskError({
      code: 'EDGE_LAUNCH_FAILED',
      task: 'publish',
      userMessage: retryResult.error || 'Edge 启动失败',
      retryable: true,
    })
  }
}

export async function publishArticle(options: PublishArticleOptions): Promise<{ status: 'filled' | 'published' }> {
  let markdownFile = options.markdownPath

  emitStep(options.reporter, 1, '打开知乎编辑器')
  emitLog(options.reporter, 'info', '步骤 1: 启动 Edge 浏览器（CDP 调试模式）')
  await ensureEdgeReady(options.reporter)

  const loginState = await getZhihuLoginState()
  if (!loginState.loggedIn) {
    throw createTaskError({
      code: 'ZHIHU_NOT_LOGGED_IN',
      task: 'publish',
      userMessage: loginState.reason || '知乎未登录，请先在 Edge 中登录知乎后再发布',
      retryable: true,
    })
  }
  emitLog(options.reporter, 'success', `知乎登录状态正常${loginState.displayName ? `：${loginState.displayName}` : ''}`)

  emitStep(options.reporter, 2, '填充文章内容')
  emitLog(options.reporter, 'info', '步骤 2: 转换 Markdown 为 HTML')

  const stat = fs.statSync(markdownFile)
  if (stat.isDirectory()) {
    const files = fs.readdirSync(markdownFile).filter((file) => file.endsWith('.md'))
    if (files.length === 0) {
      throw createTaskError({
        code: 'MARKDOWN_FILE_NOT_FOUND',
        task: 'publish',
        userMessage: '目录中没有找到 .md 文件',
        retryable: false,
        recoverable: false,
      })
    }
    markdownFile = `${markdownFile}/${files[0]}`
  }

  const conversion = await convertMarkdownToZhihuHtml(markdownFile)
  emitLog(options.reporter, 'success', 'Markdown 转换完成')
  emitLog(options.reporter, 'success', `标题: ${conversion.title}`)
  emitLog(options.reporter, 'success', `话题: ${conversion.topics.join(', ')}`)

  emitStep(options.reporter, 3, '等待页面就绪')
  emitLog(options.reporter, 'info', '步骤 3: 填充标题和正文到知乎编辑器')

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

    emitStep(options.reporter, 4, '完成')
    emitLog(options.reporter, 'info', '步骤 4: 发布完成')
    emitLog(options.reporter, 'info', '发布报告', true)
    emitLog(options.reporter, 'info', `文件: ${markdownFile}`, false)
    emitLog(options.reporter, 'info', `标题: ${conversion.title}`, false)
    emitLog(options.reporter, 'info', `话题: ${conversion.topics.join(', ')}`, false)
    emitLog(options.reporter, 'success', '文章已填充到知乎编辑器')

    if (options.autoSubmit) {
      await clickPublishButton(cdp, page.sessionId)
      emitLog(options.reporter, 'success', '文章已自动发布')
      return { status: 'published' }
    }

    emitLog(options.reporter, 'warning', '请在浏览器中检查后手动点击「发布」')
    emitLog(options.reporter, 'info', '浏览器已保持打开状态，请完成发布后关闭', false)
    return { status: 'filled' }
  } finally {
    cdp.close()
  }
}