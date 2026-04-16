import type { TaskEvent, TaskKind } from '../../../shared/task-events'
import type { LogEntry } from '../components/LogPanel'

export function createLogEntryFromTaskEvent(event: TaskEvent): LogEntry | null {
  if (event.type === 'step') {
    return {
      message: `阶段更新：${event.label}`,
      timestamp: event.timestamp,
      important: true,
      tone: 'step',
    }
  }

  if (event.type === 'log') {
    const tone = event.level === 'success'
      ? 'success'
      : event.level === 'warning'
        ? 'warning'
        : event.level === 'error'
          ? 'error'
          : 'info'

    return {
      message: event.message,
      timestamp: event.timestamp,
      important: event.important,
      tone,
    }
  }

  if (event.type === 'state' && event.error) {
    return {
      message: event.error.userMessage,
      timestamp: event.timestamp,
      important: true,
      tone: event.state === 'cancelled' ? 'warning' : 'error',
    }
  }

  return null
}

export function isTaskEventFor(task: TaskKind, event: TaskEvent): boolean {
  return event.task === task
}

export function getTaskErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return '任务执行失败'
}