import type { ServerEnv } from '@forge/shared'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompleteOptions {
  model: string
  messages: LlmMessage[]
  onChunk?: (text: string) => void
  signal?: AbortSignal
}

export interface LlmClient {
  /** Streams chunks to onChunk (if provided) and resolves with the full text. */
  complete(opts: CompleteOptions): Promise<string>
  readonly kind: 'mock' | 'openrouter'
}

/** Deterministic stand-in used until OPENROUTER_API_KEY is supplied. */
export class MockLlmClient implements LlmClient {
  readonly kind = 'mock' as const

  async complete(opts: CompleteOptions): Promise<string> {
    const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')
    const text = `Ronald (mock): I read "${lastUser?.content ?? ''}". Connect OPENROUTER_API_KEY for a real reply.`
    for (const word of text.split(' ')) {
      opts.onChunk?.(`${word} `)
    }
    return text
  }
}

/**
 * OpenRouter-backed client (chat completions, SSE streaming). Only constructed when a
 * key is present; callers fall back to MockLlmClient otherwise.
 */
export class OpenRouterLlmClient implements LlmClient {
  readonly kind = 'openrouter' as const
  private readonly endpoint = 'https://openrouter.ai/api/v1/chat/completions'

  constructor(private readonly apiKey: string) {}

  async complete(opts: CompleteOptions): Promise<string> {
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: opts.model, messages: opts.messages, stream: true }),
      signal: opts.signal,
    })
    if (!res.ok || !res.body) {
      throw new Error(`openrouter: ${res.status} ${res.statusText}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const chunk = json.choices?.[0]?.delta?.content
          if (chunk) {
            full += chunk
            opts.onChunk?.(chunk)
          }
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }
    return full
  }
}

export function createLlmClient(env: ServerEnv): LlmClient {
  if (env.OPENROUTER_API_KEY) return new OpenRouterLlmClient(env.OPENROUTER_API_KEY)
  return new MockLlmClient()
}
