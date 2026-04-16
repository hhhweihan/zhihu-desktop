import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { marked } from 'marked'

export interface ZhihuMarkdownResult {
  title: string
  htmlPath: string
  bodyHtmlPath: string
  topics: string[]
  bodyHtml: string
}

function extractTitle(content: string): string | null {
  const match = content.match(/^# (.+)$/m)
  return match ? match[1].trim() : null
}

function extractTopics(content: string): string[] {
  const match = content.match(/<!--\s*话题[：:]\s*(.+?)\s*-->/)
  if (!match) return []
  return match[1].split(/[,，]/).map((item) => item.trim()).filter(Boolean)
}

function wrapHtml(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
  h1, h2, h3 { font-weight: 600; margin-top: 1.5em; }
  h1 { font-size: 1.6em; }
  h2 { font-size: 1.3em; }
  h3 { font-size: 1.1em; }
  p { margin: 1em 0; }
  code { background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f5f5f5; padding: 16px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #ddd; margin: 1em 0; padding: 0.5em 1em; color: #666; }
  ul, ol { padding-left: 2em; }
  a { color: #0066ff; text-decoration: none; }
  img { max-width: 100%; }
  strong { font-weight: 600; }
  hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`
}

export async function convertMarkdownToZhihuHtml(markdownFilePath: string, explicitTitle?: string): Promise<ZhihuMarkdownResult> {
  const resolvedPath = path.resolve(markdownFilePath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`)
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8')
  const title = explicitTitle ?? extractTitle(content) ?? path.basename(resolvedPath, '.md')
  const topics = extractTopics(content)
  const bodyMd = content.replace(/^# .+$/m, '').trim()
  const cleanBodyMd = bodyMd.replace(/<!--\s*话题[：:].+?-->/g, '').trim()
  const bodyHtml = await marked(cleanBodyMd)

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhihu-'))
  const htmlPath = path.join(tempDir, 'article.html')
  const bodyHtmlPath = path.join(tempDir, 'body.html')
  fs.writeFileSync(htmlPath, wrapHtml(bodyHtml), 'utf-8')
  fs.writeFileSync(bodyHtmlPath, bodyHtml, 'utf-8')

  return {
    title,
    htmlPath,
    bodyHtmlPath,
    topics,
    bodyHtml,
  }
}