import { logger } from './logger'

let installed = false

export const installMonitoring = () => {
  if (installed) return
  installed = true

  window.addEventListener('error', (event) => {
    logger.error('browser:unhandled-error', {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      error: logger.errorPayload(event.error),
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('browser:unhandled-rejection', {
      reason: logger.errorPayload(event.reason),
    })
  })

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      logger.event('browser.session_hidden', {
        path: window.location.pathname,
      })
    }
  })
}
