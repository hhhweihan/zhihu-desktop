import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

interface GenerateArgs {
  topic: string
  apiKey: string
  outputDir?: string
  model?: string
  baseUrl?: string
}

function emitProgress(message: string): void {
  console.error(message)
}

function emitStep(step: number, label: string): void {
  console.error(`__STEP__write:${step}:${label}`)
}

function parseArgs(argv: string[]): GenerateArgs {
  const args: Partial<GenerateArgs> = {}
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--topic' && argv[i + 1]) args.topic = argv[++i]
    if (argv[i] === '--api-key' && argv[i + 1]) args.apiKey = argv[++i]
    if (argv[i] === '--output-dir' && argv[i + 1]) args.outputDir = argv[++i]
    if (argv[i] === '--model' && argv[i + 1]) args.model = argv[++i]
    if (argv[i] === '--base-url' && argv[i + 1]) args.baseUrl = argv[++i]
  }
  if (!args.topic) { console.error('--topic 必填'); process.exit(1) }
  if (!args.apiKey) { console.error('--api-key 必填'); process.exit(1) }
  return args as GenerateArgs
}

async function generateArticle(args: GenerateArgs): Promise<void> {
  const clientOpts: ConstructorParameters<typeof Anthropic>[0] = { apiKey: args.apiKey }
  if (args.baseUrl) clientOpts.baseURL = args.baseUrl
  const client = new Anthropic(clientOpts)
  const model = args.model || 'claude-sonnet-4-6'

  emitStep(1, '整理写作要求')
  emitProgress(`▶ 开始生成文章：${args.topic}`)
  emitProgress(`使用模型：${model}`)
  emitProgress('阶段 1/5：整理写作要求')

  const systemPrompt = `你是一位有 10 年经验的技术博主，擅长写知乎技术文章。
写作规范：
- 标题党适度，真实不夸张
- 用第一人称，有个人观点
- 代码示例要真实可运行
- 避免 AI 生成腔调（不用"让我们、首先、不难看出"等）
- 文章长度 1500-3000 字
- 使用 Markdown 格式
- 文章开头是 # 标题（一级标题）
- 适当加入个人踩坑经历`

  emitStep(2, '构建提示词')
  emitProgress('阶段 2/5：构建提示词并发起模型请求')

  let fullText = ''
  let nextProgressChars = 600
  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `请写一篇关于「${args.topic}」的知乎技术文章。要求：
1. 标题要吸引人但不夸张
2. 有具体的代码示例
3. 结合实际项目经验
4. 末尾加：<!-- 话题：技术、编程 -->`
      }
    ]
  })

  emitStep(3, '流式生成正文')
  emitProgress('阶段 3/5：模型开始流式生成正文')

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      const text = chunk.delta.text
      fullText += text
      process.stdout.write(text)
      if (fullText.length >= nextProgressChars) {
        emitProgress(`写作中：已生成约 ${fullText.length} 字符`)
        nextProgressChars += 600
      }
    }
  }

  emitStep(4, '保存文章文件')
  emitProgress('阶段 4/5：整理标题并落盘保存')

  const titleMatch = fullText.match(/^# (.+)$/m)
  const title = titleMatch ? titleMatch[1] : args.topic

  const outputDir = args.outputDir || path.join(os.tmpdir(), 'zhihu-desktop')
  fs.mkdirSync(outputDir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const safeName = title.replace(/[/\\:*?"<>|]/g, '-').slice(0, 50)
  const mdPath = path.join(outputDir, `${date}-${safeName}.md`)
  fs.writeFileSync(mdPath, fullText, 'utf-8')

  emitStep(5, '生成完成')
  emitProgress('阶段 5/5：生成完成')
  emitProgress(`✓ 文章已保存：${mdPath}`)
  console.error(`__RESULT__${JSON.stringify({ title, mdPath })}`)
}

generateArticle(parseArgs(process.argv))
