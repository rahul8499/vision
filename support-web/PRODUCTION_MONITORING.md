# Production monitoring

This support dashboard emits structured browser/API logs without changing user flows.

## Frontend environment

- `VITE_LOG_ENDPOINT`: optional HTTPS endpoint that accepts JSON log entries.
- `VITE_LOG_LEVEL`: minimum level to emit: `debug`, `info`, `warn`, or `error`.
- `VITE_APP_VERSION`: deployed build version, commit SHA, or release tag.
- `VITE_SLOW_REQUEST_MS`: API duration threshold before logging `support-api:slow-request`.

## Backend environment

- `SENTRY_DSN`: optional Sentry DSN for backend exceptions.
- `SENTRY_ENVIRONMENT`: release environment name, defaults to `production`.
- `SENTRY_TRACES_SAMPLE_RATE`: Sentry tracing sample rate, defaults to `0.05`.
- `PRODUCTION_SLOW_API_THRESHOLD_MS`: Django slow API threshold, defaults to `1500`.
- `PRODUCTION_MONITORED_PATH_PREFIXES`: comma-separated monitored prefixes, defaults to `/api/,/support-api/`.

## Events

- `browser:unhandled-error`: uncaught browser exceptions.
- `browser:unhandled-rejection`: unhandled promise rejections.
- `support-api:server-error`: API responses with status `>= 500`.
- `support-api:request-failed`: API failures that return a response message.
- `support-api:slow-request`: frontend API responses slower than the configured threshold.
- `api_failure`: backend monitored API routes returning `>= 500`.
- `slow_api`: backend monitored API routes slower than `PRODUCTION_SLOW_API_THRESHOLD_MS`.
- `event:browser.session_hidden`: page/session visibility marker sent during tab hide.

## Production notes

- Leave `VITE_LOG_ENDPOINT` empty if the backend log ingestion route is not ready.
- Use an allowlisted HTTPS endpoint in production; do not send logs to third-party URLs with user data.
- Browser stack traces are only included during development to reduce sensitive production leakage.
- Logs are best-effort: `sendBeacon` is used first, with `fetch(..., keepalive: true)` as fallback.
