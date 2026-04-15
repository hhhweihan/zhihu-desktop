interface Props { score: number }

export default function ScoreBadge({ score }: Props) {
  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 80, height: 80, borderRadius: '50%',
      border: `4px solid ${color}`, fontSize: 24, fontWeight: 'bold', color
    }}>
      {score}
    </div>
  )
}
