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

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface ParsedErrorContext {
  rawMessage: string
  normalizedMessage: string
  statusCode?: number
  providerType?: string
  providerMessage?: string
  requestId?: string
}

function tryParseEmbeddedJson(rawMessage: string): Record<string, unknown> | null {
  const firstBraceIndex = rawMessage.indexOf('{')
  if (firstBraceIndex === -1) {
    return null
  }

  try {
    return JSON.parse(rawMessage.slice(firstBraceIndex)) as Record<string, unknown>
  } catch {
    return null
  }
}

function parseErrorContext(error: unknown): ParsedErrorContext {
  const rawMessage = extractErrorMessage(error)
  const embeddedJson = tryParseEmbeddedJson(rawMessage)
  const nestedError = embeddedJson?.error
  const providerError = nestedError && typeof nestedError === 'object'
    ? nestedError as Record<string, unknown>
    : undefined

  const statusMatch = rawMessage.match(/(?:error:\s*)?(\d{3})/i)
  const statusCode = statusMatch ? Number(statusMatch[1]) : undefined
  const providerType = typeof providerError?.type === 'string'
    ? providerError.type
    : typeof embeddedJson?.type === 'string'
      ? embeddedJson.type
      : undefined
  const providerMessage = typeof providerError?.message === 'string'
    ? providerError.message
    : typeof embeddedJson?.message === 'string'
      ? embeddedJson.message
      : undefined
  const requestId = typeof embeddedJson?.request_id === 'string' ? embeddedJson.request_id : undefined

  const normalizedMessage = `${rawMessage}\n${providerType ?? ''}\n${providerMessage ?? ''}`.toLowerCase()

  return {
    rawMessage,
    normalizedMessage,
    statusCode,
    providerType,
    providerMessage,
    requestId,
  }
}

export function toUserFriendlyErrorMessage(error: unknown): string {
  const context = parseErrorContext(error)
  const message = context.rawMessage
  const normalized = context.normalizedMessage

  if (normalized.includes('insufficient balance') || normalized.includes('余额不足')) {
    return 'AI 服务账户余额不足或额度已用尽，请检查当前 API Key 和 Base URL 对应账户的可用额度。'
  }

  if (normalized.includes('insufficient_quota') || normalized.includes('quota') || normalized.includes('credit')) {
    return 'AI 服务额度不足或已超出配额，请检查当前账户套餐、余额或调用额度。'
  }

  if (normalized.includes('invalid_api_key') || normalized.includes('authentication') || normalized.includes('unauthorized') || normalized.includes('api key')) {
    return 'API Key 无效或认证失败，请检查当前 API Key 是否填写正确。'
  }

  if (context.statusCode === 401 || context.statusCode === 403 || normalized.includes('forbidden')) {
    return '当前请求未通过服务端鉴权，请检查 API Key、账号权限或该模型的开通状态。'
  }

  if (normalized.includes('invalid_request_error') || normalized.includes('invalid request') || context.statusCode === 400 || context.statusCode === 422) {
    return '请求参数不被 AI 服务接受，请检查模型名称、Base URL，或缩短输入内容后重试。'
  }

  if (normalized.includes('context_length') || normalized.includes('maximum context') || normalized.includes('prompt is too long') || context.statusCode === 413) {
    return '输入内容过长，超出了模型可处理范围，请缩短主题或减少上下文后重试。'
  }

  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return '请求过于频繁，已触发服务端限流，请稍后重试。'
  }

  if (context.statusCode === 429) {
    return 'AI 服务当前触发了限流，请稍后重试。'
  }

  if (normalized.includes('overloaded_error') || normalized.includes('overloaded error') || normalized.includes('529')) {
    return 'AI 服务当前负载过高，暂时无法处理请求，请稍后重试。'
  }

  if (normalized.includes('model') && (normalized.includes('not found') || normalized.includes('does not exist') || normalized.includes('unsupported'))) {
    return '当前配置的模型不可用，请检查模型名称是否正确，或确认该服务已开通该模型。'
  }

  if (context.statusCode === 404) {
    return '请求的模型或接口地址不存在，请检查模型名称和 Base URL 是否填写正确。'
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return '请求 AI 服务超时，请稍后重试，并检查网络或接口地址是否可用。'
  }

  if (normalized.includes('network') || normalized.includes('fetch failed') || normalized.includes('econnrefused') || normalized.includes('enotfound') || normalized.includes('socket hang up')) {
    return '无法连接到 AI 服务，请检查网络连接以及 Base URL 是否正确。'
  }

  if (context.statusCode === 502 || normalized.includes('bad gateway')) {
    return 'AI 服务网关暂时异常，请稍后重试。'
  }

  if (context.statusCode === 503 || normalized.includes('service unavailable')) {
    return 'AI 服务暂时不可用，请稍后重试。'
  }

  if (context.statusCode === 504 || normalized.includes('gateway timeout')) {
    return 'AI 服务响应超时，请稍后重试。'
  }

  if (context.statusCode === 500 || normalized.includes('500') && normalized.includes('api_error') || normalized.includes('internal server error')) {
    return 'AI 服务返回了内部错误，请稍后重试；如果持续出现，请检查当前接口服务状态。'
  }

  return message || '任务执行失败'
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

  const message = toUserFriendlyErrorMessage(error)
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