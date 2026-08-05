type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

const isDevelopment = import.meta.env.DEV
const logEndpoint = import.meta.env.VITE_LOG_ENDPOINT?.trim()
const appName = import.meta.env.VITE_APP_NAME || 'AARX Support Web'
const appVersion = import.meta.env.VITE_APP_VERSION || 'unknown'
const enabledLevels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}
const configuredLevel = (import.meta.env.VITE_LOG_LEVEL || (isDevelopment ? 'debug' : 'info')) as LogLevel
const minimumLevel = enabledLevels[configuredLevel] ?? enabledLevels.info

const safeStringify = (value: unknown) => {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return '[unserializable]'
  }
}

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
    }
  }

  return error
}

const emitRemote = (entry: LogContext) => {
  if (!logEndpoint) return

  const body = safeStringify(entry)
  const headers = { type: 'application/json' }

  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(logEndpoint, new Blob([body], headers))
    if (sent) return
  }

  void fetch(logEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined)
}

const emit = (level: LogLevel, message: string, context?: LogContext) => {
  if (enabledLevels[level] < minimumLevel) return null

  const entry = {
    timestamp: new Date().toISOString(),
    app: appName,
    version: appVersion,
    environment: import.meta.env.MODE,
    level,
    message,
    path: window.location.pathname,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  }

  const prefix = `[${level.toUpperCase()}] ${message}`

  if (level === 'error') {
    console.error(prefix, context ?? '')
  } else if (level === 'warn') {
    console.warn(prefix, context ?? '')
  } else if (level === 'debug') {
    if (isDevelopment) console.debug(prefix, context ?? '')
  } else {
    console.info(prefix, context ?? '')
  }

  if (!isDevelopment && level !== 'debug') emitRemote(entry)

  return entry
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit('debug', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  error: (message: string, context?: LogContext) => emit('error', message, context),
  event: (name: string, context?: LogContext) => emit('info', `event:${name}`, context),
  inspect: safeStringify,
  errorPayload: serializeError,
}
