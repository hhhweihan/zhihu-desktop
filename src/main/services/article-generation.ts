import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'

export interface GenerateArticleOptions {
  topic: string
  apiKey: string
  outputDir: string
  model: string
  baseUrl?: string
  onLog?: (line: string) => void
}

export interface GenerateArticleResult {
  title: string
  mdPath: string
}

interface RunningGeneration {
  promise: Promise<GenerateArticleResult>
  abort: () => void
}

function emitLog(onLog: GenerateArticleOptions['onLog'], message: string): void {
  onLog?.(message)
}

function emitStep(onLog: GenerateArticleOptions['onLog'], step: number, label: string): void {
  onLog?.(`__STEP__write:${step}:${label}`)
}

function getTitleFromMarkdown(content: string, fallbackTitle: string): string {
  const titleMatch = content.match(/^# (.+)$/m)
  return titleMatch ? titleMatch[1] : fallbackTitle
}

function buildSystemPrompt(): string {
  return `你是一位有 10 年经验的技术博主，擅长写知乎技术文章。
写作规范：
- 标题党适度，真实不夸张
- 用第一人称，有个人观点
- 代码示例要真实可运行
- 避免 AI 生成腔调（不用"让我们、首先、不难看出"等）
- 文章长度 1500-3000 字
- 使用 Markdown 格式
- 文章开头是 # 标题（一级标题）
- 适当加入个人踩坑经历`
}

function buildUserPrompt(topic: string): string {
  return `请写一篇关于「${topic}」的知乎技术文章。要求：
1. 标题要吸引人但不夸张
2. 有具体的代码示例
3. 结合实际项目经验
4. 末尾加：<!-- 话题：技术、编程 -->`
}

export function startArticleGeneration(options: GenerateArticleOptions): RunningGeneration {
  const clientOptions: ConstructorParameters<typeof Anthropic>[0] = { apiKey: options.apiKey }
  if (options.baseUrl) {
    clientOptions.baseURL = options.baseUrl
  }

  const client = new Anthropic(clientOptions)
  const model = options.model || 'claude-sonnet-4-6'
  let stream: Awaited<ReturnType<typeof client.messages.stream>> | null = null
  let aborted = false

  const promise = (async () => {
    emitStep(options.onLog, 1, '整理写作要求')
    emitLog(options.onLog, `▶ 开始生成文章：${options.topic}`)
    emitLog(options.onLog, `使用模型：${model}`)
    emitLog(options.onLog, '阶段 1/5：整理写作要求')

    emitStep(options.onLog, 2, '构建提示词')
    emitLog(options.onLog, '阶段 2/5：构建提示词并发起模型请求')

    let fullText = ''
    let nextProgressChars = 600

    stream = await client.messages.stream({
      model,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(options.topic),
        },
      ],
    })

    emitStep(options.onLog, 3, '流式生成正文')
    emitLog(options.onLog, '阶段 3/5：模型开始流式生成正文')

    try {
      for await (const chunk of stream) {
        if (aborted) {
          break
        }

        if (chunk.type !== 'content_block_delta' || chunk.delta.type !== 'text_delta') {
          continue
        }

        const text = chunk.delta.text
        fullText += text

        if (fullText.length >= nextProgressChars) {
          emitLog(options.onLog, `写作中：已生成约 ${fullText.length} 字符`)
          nextProgressChars += 600
        }
      }
    } catch (error) {
      if (aborted) {
        throw new Error('生成已取消')
      }
      throw error
    }

    if (aborted) {
      throw new Error('生成已取消')
    }

    emitStep(options.onLog, 4, '保存文章文件')
    emitLog(options.onLog, '阶段 4/5：整理标题并落盘保存')

    const title = getTitleFromMarkdown(fullText, options.topic)
    fs.mkdirSync(options.outputDir, { recursive: true })
    const date = new Date().toISOString().slice(0, 10)
    const safeName = title.replace(/[/\\:*?"<>|]/g, '-').slice(0, 50)
    const mdPath = path.join(options.outputDir, `${date}-${safeName}.md`)
    fs.writeFileSync(mdPath, fullText, 'utf-8')

    emitStep(options.onLog, 5, '生成完成')
    emitLog(options.onLog, '阶段 5/5：生成完成')
    emitLog(options.onLog, `✓ 文章已保存：${mdPath}`)
    return { title, mdPath }
  })()

  return {
    promise,
    abort: () => {
      aborted = true
      stream?.controller.abort()
    },
  }
}