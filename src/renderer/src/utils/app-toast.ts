export type AppToastTone = 'info' | 'success' | 'warning' | 'error'

export interface AppToastDetail {
  message: string
  tone?: AppToastTone
}

const APP_TOAST_EVENT = 'app:toast'

export function showAppToast(message: string, tone: AppToastTone = 'info'): void {
  window.dispatchEvent(new CustomEvent<AppToastDetail>(APP_TOAST_EVENT, {
    detail: { message, tone },
  }))
}

export function getAppToastEventName(): string {
  return APP_TOAST_EVENT
}