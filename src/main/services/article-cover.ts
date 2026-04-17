import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { createTaskError, type TaskReporter } from './task-runtime'

export type CoverTemplate = 'comparison' | 'minimalist' | 'feature'

export interface GenerateCoverOptions {
  markdownPath: string
  template: CoverTemplate
  title?: string
  subtitle?: string
  reporter?: TaskReporter
}

export interface CoverGenerationResult {
  title: string
  subtitle?: string
  template: CoverTemplate
  svgPath: string
  pngPath: string
  previewDataUrl: string
}

function emitStep(reporter: TaskReporter | undefined, step: number, label: string): void {
  reporter?.emitStep(step, 3, label)
}

function emitLog(reporter: TaskReporter | undefined, level: 'info' | 'success' | 'warning' | 'error', message: string, important = true): void {
  reporter?.emitLog(level, message, important)
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sanitizeFileBase(value: string): string {
  return value
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60) || 'article'
}

function extractCoverMetadata(markdownPath: string): { title: string; subtitle?: string } {
  const content = fs.readFileSync(markdownPath, 'utf-8')
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const subtitle = content.match(/^>\s+(.+)$/m)?.[1]?.trim()
  return {
    title: heading || path.basename(markdownPath, '.md'),
    subtitle: subtitle || undefined,
  }
}

function generateComparisonSvg(title: string, subtitle: string): string {
  const displayTitle = title.length > 30 ? `${title.slice(0, 27)}...` : title
  return `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#0f1e3c"/>
  <rect x="100" y="280" width="680" height="520" fill="rgba(25, 45, 80, 0.92)" stroke="#00b4ff" stroke-width="4" rx="22"/>
  <rect x="1140" y="280" width="680" height="520" fill="rgba(25, 35, 60, 0.92)" stroke="#7f8ea3" stroke-width="4" rx="22"/>
  <text x="140" y="360" font-size="72" font-weight="700" fill="#00b4ff" font-family="Microsoft YaHei, Arial, sans-serif">Plan A</text>
  <text x="140" y="435" font-size="48" fill="#ffffff" font-family="Microsoft YaHei, Arial, sans-serif">高效方案</text>
  <text x="140" y="495" font-size="48" fill="#ffffff" font-family="Microsoft YaHei, Arial, sans-serif">全局优化</text>
  <text x="140" y="590" font-size="54" font-weight="700" fill="#00b4ff" font-family="Microsoft YaHei, Arial, sans-serif">最优选择</text>
  <text x="1180" y="360" font-size="72" font-weight="700" fill="#7f8ea3" font-family="Microsoft YaHei, Arial, sans-serif">Plan B</text>
  <text x="1180" y="435" font-size="48" fill="#ffffff" font-family="Microsoft YaHei, Arial, sans-serif">局部优化</text>
  <text x="1180" y="495" font-size="48" fill="#ffffff" font-family="Microsoft YaHei, Arial, sans-serif">片段建议</text>
  <text x="1180" y="590" font-size="54" font-weight="700" fill="#7f8ea3" font-family="Microsoft YaHei, Arial, sans-serif">备选方案</text>
  <text x="960" y="565" font-size="168" font-weight="800" fill="#ff7b5c" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">VS</text>
  <text x="960" y="128" font-size="92" font-weight="800" fill="#00b4ff" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">${escapeSvgText(displayTitle)}</text>
  <text x="960" y="214" font-size="56" fill="#ffffff" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">${escapeSvgText(subtitle || '深度对比分析')}</text>
  <text x="960" y="1000" font-size="46" fill="#93a4bb" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">选择正确，成本优化 | 帮你算清账</text>
  <line x1="300" y1="900" x2="500" y2="900" stroke="#00b4ff" stroke-width="3"/>
  <line x1="1420" y1="900" x2="1620" y2="900" stroke="#7f8ea3" stroke-width="3"/>
</svg>`
}

function generateMinimalistSvg(title: string, subtitle: string): string {
  return `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1920" height="1080" fill="#f5f7fb"/>
  <rect x="200" y="300" width="1520" height="480" fill="none" stroke="#0f1e3c" stroke-width="2" rx="22"/>
  <text x="960" y="485" font-size="96" font-weight="800" fill="#0f1e3c" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">${escapeSvgText(title)}</text>
  <text x="960" y="590" font-size="52" fill="#546274" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">${escapeSvgText(subtitle || '深度分析')}</text>
  <line x1="400" y1="850" x2="1520" y2="850" stroke="#0f1e3c" stroke-width="3"/>
</svg>`
}

function generateFeatureSvg(title: string, subtitle: string): string {
  return `<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f1e3c"/>
      <stop offset="100%" stop-color="#1c2f58"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bgGrad)"/>
  <rect x="0" y="0" width="960" height="1080" fill="rgba(0, 180, 255, 0.1)"/>
  <text x="960" y="360" font-size="96" font-weight="800" fill="#00b4ff" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">${escapeSvgText(title)}</text>
  <text x="960" y="550" font-size="58" fill="#ffffff" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">${escapeSvgText(subtitle || '全面指南')}</text>
  <rect x="200" y="800" width="1520" height="200" fill="none" stroke="#00b4ff" stroke-width="3" rx="18"/>
  <text x="960" y="920" font-size="48" fill="#00b4ff" text-anchor="middle" font-family="Microsoft YaHei, Arial, sans-serif">深度解析 | 实战指导 | 成本优化</text>
</svg>`
}

function renderSvg(template: CoverTemplate, title: string, subtitle: string): string {
  switch (template) {
    case 'minimalist':
      return generateMinimalistSvg(title, subtitle)
    case 'feature':
      return generateFeatureSvg(title, subtitle)
    case 'comparison':
    default:
      return generateComparisonSvg(title, subtitle)
  }
}

function buildPreviewDataUrl(svgContent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`
}

function svgToPngBuffer(svgContent: string): Buffer {
  try {
    const renderer = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: 1920,
      },
      font: {
        loadSystemFonts: true,
        defaultFontFamily: 'Microsoft YaHei',
      },
    })

    return renderer.render().asPng()
  } catch {
    throw createTaskError({
      code: 'COVER_PNG_RENDER_FAILED',
      task: 'cover',
      userMessage: '封面 PNG 渲染失败，请检查标题文本或本机字体环境后重试',
      retryable: true,
    })
  }
}

export async function generateArticleCover(options: GenerateCoverOptions): Promise<CoverGenerationResult> {
  if (!fs.existsSync(options.markdownPath)) {
    throw createTaskError({
      code: 'COVER_MARKDOWN_NOT_FOUND',
      task: 'cover',
      userMessage: '文章文件不存在，无法生成封面',
      retryable: false,
      recoverable: false,
    })
  }

  emitStep(options.reporter, 1, '读取文章元信息')
  emitLog(options.reporter, 'info', '正在读取文章标题与摘要...')

  const metadata = extractCoverMetadata(options.markdownPath)
  const title = options.title?.trim() || metadata.title
  const subtitle = options.subtitle?.trim() || metadata.subtitle || ''
  const articleDir = path.dirname(options.markdownPath)
  const articleBaseName = sanitizeFileBase(path.basename(options.markdownPath, '.md'))
  const svgPath = path.join(articleDir, `${articleBaseName}.cover.svg`)
  const pngPath = path.join(articleDir, `${articleBaseName}.cover.png`)

  emitStep(options.reporter, 2, '生成封面内容')
  emitLog(options.reporter, 'info', `正在使用 ${options.template} 模板生成封面...`)
  const svgContent = renderSvg(options.template, title, subtitle)

  emitStep(options.reporter, 3, '保存封面文件')
  emitLog(options.reporter, 'info', '正在保存 SVG 与 PNG 文件...')
  fs.writeFileSync(svgPath, svgContent, 'utf-8')
  fs.writeFileSync(pngPath, svgToPngBuffer(svgContent))

  emitLog(options.reporter, 'success', `封面 SVG 已保存：${svgPath}`)
  emitLog(options.reporter, 'success', `封面 PNG 已保存：${pngPath}`)

  return {
    title,
    subtitle: subtitle || undefined,
    template: options.template,
    svgPath,
    pngPath,
    previewDataUrl: buildPreviewDataUrl(svgContent),
  }
}