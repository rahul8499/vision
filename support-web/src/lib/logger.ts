type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

const isDevelopment = import.meta.env.DEV

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
      stack: error.stack,
    }
  }

  return error
}

const emit = (level: LogLevel, message: string, context?: LogContext) => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
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
