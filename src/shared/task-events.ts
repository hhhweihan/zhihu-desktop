export type TaskKind = 'generate' | 'review' | 'publish' | 'cover'

export type TaskState = 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'cancelled'

export type TaskLogLevel = 'info' | 'success' | 'warning' | 'error'

export interface AppTaskError {
  code: string
  task: TaskKind
  state: Extract<TaskState, 'failed' | 'cancelled'>
  userMessage: string
  detail?: string
  recoverable: boolean
  retryable: boolean
}

interface TaskEventBase {
  task: TaskKind
  timestamp: number
}

export interface TaskStateEvent extends TaskEventBase {
  type: 'state'
  state: TaskState
  error?: AppTaskError
}

export interface TaskStepEvent extends TaskEventBase {
  type: 'step'
  state: Extract<TaskState, 'running'>
  step: number
  totalSteps: number
  label: string
}

export interface TaskLogEvent extends TaskEventBase {
  type: 'log'
  level: TaskLogLevel
  message: string
  important: boolean
}

export type TaskEvent = TaskStateEvent | TaskStepEvent | TaskLogEvent