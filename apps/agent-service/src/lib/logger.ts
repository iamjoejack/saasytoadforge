type Fields = Record<string, unknown>

const SECRET_KEY = /(key|token|secret|authorization|password|cookie)/i
const SECRET_VALUE = /\b(sk-[A-Za-z0-9_-]{6,}|Bearer\s+\S+)\b/g

/** Redact secret-looking keys and inline secret-looking values. Never log raw secrets. */
export function redact(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '[redacted]')
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object') {
    const out: Fields = {}
    for (const [key, v] of Object.entries(value)) {
      out[key] = SECRET_KEY.test(key) ? '[redacted]' : redact(v)
    }
    return out
  }
  return value
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export function logLine(level: LogLevel, msg: string, fields: Fields = {}): string {
  return JSON.stringify({ level, msg, ...(redact(fields) as Fields) })
}

export const logger = {
  info: (msg: string, fields?: Fields) => {
    console.log(logLine('info', msg, fields))
  },
  warn: (msg: string, fields?: Fields) => {
    console.warn(logLine('warn', msg, fields))
  },
  error: (msg: string, fields?: Fields) => {
    console.error(logLine('error', msg, fields))
  },
}
