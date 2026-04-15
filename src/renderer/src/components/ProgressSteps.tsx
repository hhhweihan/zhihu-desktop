// src/renderer/src/components/ProgressSteps.tsx
interface Step {
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}

interface Props {
  steps: Step[]
}

const STATUS_ICON: Record<Step['status'], string> = {
  pending: '○',
  active: '⏳',
  done: '✓',
  error: '✗',
}

const STATUS_COLOR: Record<Step['status'], string> = {
  pending: 'var(--text-muted)',
  active: 'var(--brand-purple-light)',
  done: 'var(--color-success)',
  error: 'var(--color-error)',
}

export default function ProgressSteps({ steps }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginTop: 'var(--sp-4)' }}>
      {steps.map((step, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-3)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: step.status === 'active' ? 'var(--brand-purple-dim)' : 'transparent',
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            fontWeight: 700,
            fontSize: 16,
            color: STATUS_COLOR[step.status],
            width: 20,
            textAlign: 'center',
            flexShrink: 0,
          }}>
            {STATUS_ICON[step.status]}
          </span>
          <span style={{
            fontSize: 14,
            color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
          }}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
  )
}
