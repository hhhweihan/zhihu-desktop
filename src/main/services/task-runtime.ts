import type { AppTaskError, TaskEvent, TaskKind, TaskLogLevel, TaskState } from '../../shared/task-events'

export interface TaskEventSink {
  (event: TaskEvent): void
}

export interface TaskReporter {
  task: TaskKind
  emitState: (state: TaskState, error?: AppTaskError) => void
  emitStep: (step: number, totalSteps: number, label: string) => void
  emitLog: (level: TaskLogLevel, message: string, important?: boolean) => void
  queued: () => void
  running: () => void
  success: () => void
  fail: (error: unknown) => AppTaskError
  cancel: (error?: unknown) => AppTaskError
}

interface TaskErrorOptions {
  code: string
  task: TaskKind
  userMessage: string
  detail?: string
  recoverable?: boolean
  retryable?: boolean
  cancelled?: boolean
}

export class TaskOperationError extends Error {
  readonly code: string
  readonly task: TaskKind
  readonly userMessage: string
  readonly detail?: string
  readonly recoverable: boolean
  readonly retryable: boolean
  readonly cancelled: boolean

  constructor(options: TaskErrorOptions) {
    super(options.detail || options.userMessage)
    this.name = 'TaskOperationError'
    this.code = options.code
    this.task = options.task
    this.userMessage = options.userMessage
    this.detail = options.detail
    this.recoverable = options.recoverable ?? true
    this.retryable = options.retryable ?? false
    this.cancelled = options.cancelled ?? false
  }
}

export function createTaskError(options: TaskErrorOptions): TaskOperationError {
  return new TaskOperationError(options)
}

export function isTaskCancelledError(error: unknown): boolean {
  if (error instanceof TaskOperationError) {
    return error.cancelled
  }

  const message = error instanceof Error ? error.message : String(error)
  return message.includes('取消')
}

export function normalizeTaskError(task: TaskKind, error: unknown): AppTaskError {
  if (error instanceof TaskOperationError) {
    return {
      code: error.code,
      task,
      state: error.cancelled ? 'cancelled' : 'failed',
      userMessage: error.userMessage,
      detail: error.detail,
      recoverable: error.recoverable,
      retryable: error.retryable,
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  const cancelled = message.includes('取消')

  return {
    code: cancelled ? 'TASK_CANCELLED' : 'TASK_FAILED',
    task,
    state: cancelled ? 'cancelled' : 'failed',
    userMessage: message || '任务执行失败',
    detail: error instanceof Error ? error.stack : undefined,
    recoverable: true,
    retryable: true,
  }
}

export function createTaskReporter(task: TaskKind, sink?: TaskEventSink): TaskReporter {
  function emit(event: TaskEvent): void {
    sink?.(event)
  }

  return {
    task,
    emitState: (state, error) => {
      emit({
        type: 'state',
        task,
        state,
        error,
        timestamp: Date.now(),
      })
    },
    emitStep: (step, totalSteps, label) => {
      emit({
        type: 'step',
        task,
        state: 'running',
        step,
        totalSteps,
        label,
        timestamp: Date.now(),
      })
    },
    emitLog: (level, message, important = false) => {
      emit({
        type: 'log',
        task,
        level,
        message,
        important,
        timestamp: Date.now(),
      })
    },
    queued: () => {
      emit({ type: 'state', task, state: 'queued', timestamp: Date.now() })
    },
    running: () => {
      emit({ type: 'state', task, state: 'running', timestamp: Date.now() })
    },
    success: () => {
      emit({ type: 'state', task, state: 'success', timestamp: Date.now() })
    },
    fail: (error) => {
      const normalized = normalizeTaskError(task, error)
      emit({ type: 'state', task, state: 'failed', error: normalized, timestamp: Date.now() })
      return normalized
    },
    cancel: (error) => {
      const normalized = normalizeTaskError(task, error ?? createTaskError({
        code: 'TASK_CANCELLED',
        task,
        userMessage: '任务已取消',
        cancelled: true,
        retryable: true,
      }))
      emit({ type: 'state', task, state: 'cancelled', error: normalized, timestamp: Date.now() })
      return normalized
    },
  }
}

export async function retryTaskOperation<T>(
  operation: () => Promise<T>,
  options?: {
    attempts?: number
    shouldRetry?: (error: unknown, attempt: number) => boolean
    onRetry?: (attempt: number, error: unknown) => void
  },
): Promise<T> {
  const attempts = Math.max(1, options?.attempts ?? 1)

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const shouldRetry = attempt < attempts
        && !isTaskCancelledError(error)
        && (options?.shouldRetry ? options.shouldRetry(error, attempt) : true)

      if (!shouldRetry) {
        throw error
      }

      options?.onRetry?.(attempt, error)
    }
  }

  throw new Error('任务重试失败')
}