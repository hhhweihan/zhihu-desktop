import type { TaskEvent, TaskKind } from '../../../shared/task-events'
import type { LogEntry } from '../components/LogPanel'

function translateRendererErrorMessage(message: string): string {
  const normalized = message.replace(/^Error invoking remote method '[^']+':\s*/i, '').trim()

  if (/Cannot read properties of undefined \(reading 'loggedIn'\)/i.test(normalized)) {
    return '登录状态检测失败：程序没有拿到有效的知乎登录结果。请重新点击“启动 Edge 并检测”，或先切到任意知乎页面后再试。'
  }

  if (/Cannot read properties of undefined/i.test(normalized)) {
    return '程序读取页面状态时拿到了空结果，请重试；如果问题持续出现，请先刷新页面或重新启动 Edge。'
  }

  return normalized || message
}

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
    return translateRendererErrorMessage(error.message)
  }

  return '任务执行失败'
}