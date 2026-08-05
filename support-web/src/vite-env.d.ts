/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_BASE_URL: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_LOG_ENDPOINT?: string
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
  readonly VITE_SLOW_REQUEST_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
