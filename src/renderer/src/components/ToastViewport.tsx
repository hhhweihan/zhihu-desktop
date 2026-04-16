import { useEffect, useRef, useState } from 'react'
import { getAppToastEventName, type AppToastDetail } from '../utils/app-toast'

interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'success' | 'warning' | 'error'
}

export default function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)

  useEffect(() => {
    function handleToast(event: Event) {
      const customEvent = event as CustomEvent<AppToastDetail>
      const detail = customEvent.detail
      const id = nextIdRef.current++

      setItems((prev) => [...prev, { id, message: detail.message, tone: detail.tone ?? 'info' }])
      window.setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id))
      }, 2400)
    }

    window.addEventListener(getAppToastEventName(), handleToast as EventListener)
    return () => window.removeEventListener(getAppToastEventName(), handleToast as EventListener)
  }, [])

  if (items.length === 0) return null

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`}>
          {item.message}
        </div>
      ))}
    </div>
  )
}