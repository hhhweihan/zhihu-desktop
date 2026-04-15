const SEVERITY_COLOR: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' }
const TYPE_LABEL: Record<string, string> = {
  'exaggeration': '夸大表述', 'ai-tone': 'AI腔调', 'time-error': '时间问题'
}

export default function IssueList({ issues }: { issues: ReviewIssue[] }) {
  if (issues.length === 0) return <p style={{ color: '#22c55e' }}>✓ 未发现问题</p>
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {issues.map((issue, i) => (
        <li key={i} style={{ marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8 }}>
          <span style={{ color: SEVERITY_COLOR[issue.severity], fontWeight: 'bold', marginRight: 8 }}>
            [{issue.severity.toUpperCase()}]
          </span>
          <span>{TYPE_LABEL[issue.type] ?? issue.type}</span>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#374151' }}>位置：{issue.location}</p>
          <p style={{ margin: '4px 0', fontSize: 13 }}>问题：{issue.issue}</p>
          <p style={{ margin: '4px 0', fontSize: 13, color: '#2563eb' }}>建议：{issue.suggestion}</p>
        </li>
      ))}
    </ul>
  )
}
