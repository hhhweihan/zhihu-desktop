// src/renderer/src/components/MarkdownPreview.tsx
interface Props {
  content: string
  maxHeight?: number
}

function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .split('\n\n')
    .map((block) => {
      if (block.startsWith('<h') || block.startsWith('<li')) return block
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`
    })
    .join('\n')
}

export default function MarkdownPreview({ content, maxHeight = 400 }: Props) {
  return (
    <div
      className="markdown-preview"
      style={{
        maxHeight,
        overflowY: 'auto',
        padding: 'var(--sp-4)',
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--surface-3)',
        fontSize: 14,
        lineHeight: 1.7,
        color: 'var(--text-primary)',
      }}
      dangerouslySetInnerHTML={{ __html: mdToHtml(content) }}
    />
  )
}
