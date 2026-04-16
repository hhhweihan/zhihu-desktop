import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { createTaskError, retryTaskOperation, type TaskReporter } from './task-runtime'

export interface ArticlePlan {
  title: string
  angle: string
  outline: string[]
}

export interface GenerateArticleOptions {
  topic: string
  apiKey: string
  outputDir: string
  model: string
  baseUrl?: string
  plan?: ArticlePlan
  reporter?: TaskReporter
}

export interface GenerateArticleResult {
  title: string
  mdPath: string
}

export interface SuggestArticlePlansOptions {
  topic: string
  apiKey: string
  model: string
  baseUrl?: string
}

interface RunningGeneration {
  promise: Promise<GenerateArticleResult>
  abort: () => void
}

interface ParsedTextResult {
  text: string
}

function emitLog(reporter: TaskReporter | undefined, level: 'info' | 'success' | 'warning' | 'error', message: string, important = true): void {
  reporter?.emitLog(level, message, important)
}

function emitStep(reporter: TaskReporter | undefined, step: number, label: string): void {
  reporter?.emitStep(step, 5, label)
}

function getTitleFromMarkdown(content: string, fallbackTitle: string): string {
  const titleMatch = content.match(/^# (.+)$/m)
  return titleMatch ? titleMatch[1] : fallbackTitle
}

function getTextContent(response: Anthropic.Messages.Message): string {
  const textBlock = response.content.find((item): item is ParsedTextResult & typeof item => item.type === 'text')
  return textBlock?.text ?? ''
}

function parseJsonObject<T>(input: string, fallback: T): T {
  try {
    const match = input.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    return JSON.parse(match[0]) as T
  } catch {
    return fallback
  }
}

function createAnthropicClient(apiKey: string, baseUrl?: string): Anthropic {
  const clientOptions: ConstructorParameters<typeof Anthropic>[0] = { apiKey }
  if (baseUrl) {
    clientOptions.baseURL = baseUrl
  }

  return new Anthropic(clientOptions)
}

function normalizePlan(item: Partial<ArticlePlan> | null | undefined): ArticlePlan | null {
  const title = item?.title?.trim()
  const angle = item?.angle?.trim()
  const outline = Array.isArray(item?.outline)
    ? item.outline.map((entry) => String(entry).trim()).filter(Boolean)
    : []

  if (!title || !angle || outline.length < 3) {
    return null
  }

  return {
    title,
    angle,
    outline: outline.slice(0, 6),
  }
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

function buildSuggestionPrompt(topic: string): string {
  return `围绕「${topic}」设计 3 套可直接写成知乎技术文章的方案。

要求：
1. 每套方案都要包含标题、切入角度、4-6 条大纲。
2. 标题要具体，不要空泛，不要标题党。
3. 三套方案的切入角度要明显不同，例如实战复盘、原理拆解、避坑总结。
4. 大纲必须能直接指导正文写作，避免重复废话。
5. 严格返回 JSON，不要附加解释。

返回格式：
{
  "plans": [
    {
      "title": "标题",
      "angle": "一句话说明这篇文章打算怎么写",
      "outline": ["大纲1", "大纲2", "大纲3", "大纲4"]
    }
  ]
}`
}

function buildUserPrompt(topic: string, plan?: ArticlePlan): string {
  if (!plan) {
    return `请写一篇关于「${topic}」的知乎技术文章。要求：
1. 标题要吸引人但不夸张
2. 有具体的代码示例
3. 结合实际项目经验
4. 末尾加：<!-- 话题：技术、编程 -->`
  }

  return `请基于以下已确认的写作方案，写一篇关于「${topic}」的知乎技术文章。

选定标题：${plan.title}
写作角度：${plan.angle}
参考大纲：
${plan.outline.map((item, index) => `${index + 1}. ${item}`).join('\n')}

要求：
1. 文章第一行必须是一级标题，并使用这个标题：# ${plan.title}
2. 正文要严格围绕上述角度和大纲展开，但可以根据内容自然补充过渡段。
3. 有具体的代码示例。
4. 结合实际项目经验，少空话。
5. 末尾加：<!-- 话题：技术、编程 -->`
}

export async function suggestArticlePlans(options: SuggestArticlePlansOptions): Promise<ArticlePlan[]> {
  const client = createAnthropicClient(options.apiKey, options.baseUrl)
  const model = options.model || 'claude-sonnet-4-6'
  const response = await retryTaskOperation(
    () => client.messages.create({
      model,
      max_tokens: 1400,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildSuggestionPrompt(options.topic),
        },
      ],
    }),
    { attempts: 2 },
  )

  const data = parseJsonObject<{ plans?: Array<Partial<ArticlePlan>> }>(getTextContent(response), { plans: [] })
  const plans = (data.plans ?? [])
    .map((item) => normalizePlan(item))
    .filter((item): item is ArticlePlan => item !== null)
    .slice(0, 3)

  if (plans.length === 0) {
    throw new Error('标题方案生成失败，请重试')
  }

  return plans
}

export function startArticleGeneration(options: GenerateArticleOptions): RunningGeneration {
  const client = createAnthropicClient(options.apiKey, options.baseUrl)
  const model = options.model || 'claude-sonnet-4-6'
  let stream: Awaited<ReturnType<typeof client.messages.stream>> | null = null
  let aborted = false

  const promise = (async () => {
    emitStep(options.reporter, 1, '整理写作要求')
    emitLog(options.reporter, 'info', `开始生成文章：${options.topic}`)
    emitLog(options.reporter, 'info', `使用模型：${model}`)
    if (options.plan) {
      emitLog(options.reporter, 'info', `已选方案：${options.plan.title}`)
    }
    emitLog(options.reporter, 'info', '阶段 1/5：整理写作要求')

    emitStep(options.reporter, 2, '构建提示词')
    emitLog(options.reporter, 'info', '阶段 2/5：构建提示词并发起模型请求')

    let fullText = ''
    let nextProgressChars = 600

    stream = await retryTaskOperation(
      async () => client.messages.stream({
        model,
        max_tokens: 4096,
        system: buildSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(options.topic, options.plan),
          },
        ],
      }),
      {
        attempts: 2,
        onRetry: () => emitLog(options.reporter, 'warning', '模型连接异常，正在重试...', true),
      },
    )

    emitStep(options.reporter, 3, '流式生成正文')
    emitLog(options.reporter, 'info', '阶段 3/5：模型开始流式生成正文')

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
          emitLog(options.reporter, 'info', `写作中：已生成约 ${fullText.length} 字符`)
          nextProgressChars += 600
        }
      }
    } catch (error) {
      if (aborted) {
        throw createTaskError({
          code: 'TASK_CANCELLED',
          task: 'generate',
          userMessage: '生成已取消',
          cancelled: true,
          retryable: true,
        })
      }
      throw error
    }

    if (aborted) {
      throw createTaskError({
        code: 'TASK_CANCELLED',
        task: 'generate',
        userMessage: '生成已取消',
        cancelled: true,
        retryable: true,
      })
    }

    emitStep(options.reporter, 4, '保存文章文件')
    emitLog(options.reporter, 'info', '阶段 4/5：整理标题并落盘保存')

    const title = getTitleFromMarkdown(fullText, options.plan?.title || options.topic)
    fs.mkdirSync(options.outputDir, { recursive: true })
    const date = new Date().toISOString().slice(0, 10)
    const safeName = title.replace(/[/\\:*?"<>|]/g, '-').slice(0, 50)
    const mdPath = path.join(options.outputDir, `${date}-${safeName}.md`)
    fs.writeFileSync(mdPath, fullText, 'utf-8')

    emitStep(options.reporter, 5, '生成完成')
    emitLog(options.reporter, 'info', '阶段 5/5：生成完成')
    emitLog(options.reporter, 'success', `文章已保存：${mdPath}`)
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
