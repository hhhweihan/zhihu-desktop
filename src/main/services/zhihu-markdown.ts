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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function normalizeTableBlocks(html: string): string {
  return html.replace(/<table[\s\S]*?<\/table>/g, (tableHtml) => {
    const rows = Array.from(tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g))
      .map((rowMatch) => Array.from(rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)).map((cell) => stripHtml(cell[1])))
      .filter((cells) => cells.length > 0)

    if (rows.length === 0) {
      return ''
    }

    const items = rows
      .map((cells, index) => {
        const prefix = index === 0 ? '表头' : `第 ${index} 行`
        return `<li><strong>${prefix}：</strong>${escapeHtml(cells.join(' | '))}</li>`
      })
      .join('')

    return `<p><strong>表格内容</strong></p><ul>${items}</ul>`
  })
}

function normalizeListItemParagraphs(html: string): string {
  return html.replace(
    /<li>\s*<p>([\s\S]*?)<\/p>\s*((?:<(?:ul|ol)[\s\S]*?<\/(?:ul|ol)>)?)\s*<\/li>/g,
    (_match, paragraph, nestedList) => `<li>${paragraph}${nestedList || ''}</li>`
  )
}

function normalizeBlockquotes(html: string): string {
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_match, innerHtml) => {
    const paragraphs: string[] = []
    for (const item of innerHtml.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
      const paragraph = String(item[1] || '').trim()
      if (paragraph) {
        paragraphs.push(paragraph)
      }
    }

    if (paragraphs.length === 0) {
      const text = stripHtml(innerHtml)
      return text ? `<p><strong>引用：</strong>${escapeHtml(text)}</p>` : ''
    }

    return paragraphs
      .map((paragraph, index) => index === 0
        ? `<p><strong>引用：</strong>${paragraph}</p>`
        : `<p>${paragraph}</p>`)
      .join('')
  })
}

function normalizeImageParagraphs(html: string): string {
  return html.replace(/<p>\s*(<img[^>]+>)\s*<\/p>/g, (_match, imageTag) => {
    const altMatch = imageTag.match(/alt="([^"]*)"/)
    const caption = altMatch?.[1]?.trim()
    if (!caption) {
      return `<p>${imageTag}</p>`
    }

    return `<p>${imageTag}</p><p><em>${escapeHtml(caption)}</em></p>`
  })
}

function renderZhihuFriendlyHtml(markdown: string): string {
  const renderer = new marked.Renderer()

  renderer.code = ({ text, lang }: any) => {
    const language = String(lang || '').trim()
    const title = language ? `<p><strong>代码示例（${escapeHtml(language)}）</strong></p>` : ''
    const className = language ? ` class="language-${escapeHtml(language)}"` : ''
    return `${title}<pre><code${className}>${escapeHtml(String(text || ''))}</code></pre>`
  }

  renderer.image = ({ href, text, title }: any) => {
    const src = escapeHtml(String(href || ''))
    const alt = escapeHtml(String(text || ''))
    const titleAttr = title ? ` title="${escapeHtml(String(title))}"` : ''
    return `<p><img src="${src}" alt="${alt}"${titleAttr}></p>`
  }

  renderer.heading = ({ tokens, depth }: any) => {
    const text = renderer.parser.parseInline(tokens)
    const level = Math.min(Math.max(Number(depth) || 2, 2), 4)
    return `<h${level}>${text}</h${level}>`
  }

  const html = marked.parse(markdown, {
    async: false,
    gfm: true,
    breaks: false,
    renderer,
  }) as string

  return normalizeImageParagraphs(normalizeBlockquotes(normalizeListItemParagraphs(normalizeTableBlocks(html))))
    .replace(/<p>\s*<\/p>/g, '')
    .trim()
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
  const bodyHtml = renderZhihuFriendlyHtml(cleanBodyMd)

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