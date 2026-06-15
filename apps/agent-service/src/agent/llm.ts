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
  readonly kind: 'mock' | 'openrouter' | 'anthropic' | 'google'
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

/**
 * Direct Anthropic Claude client. Used when the client provides a custom Anthropic key.
 */
export class AnthropicLlmClient implements LlmClient {
  readonly kind = 'anthropic' as const
  private readonly endpoint = 'https://api.anthropic.com/v1/messages'

  constructor(private readonly apiKey: string) {}

  async complete(opts: CompleteOptions): Promise<string> {
    const systemMessage = opts.messages.find((m) => m.role === 'system')?.content
    const restMessages = opts.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }))

    let modelName = opts.model
    if (modelName.includes('claude-sonnet-4') || modelName.includes('claude-3-5-sonnet')) {
      modelName = 'claude-3-5-sonnet-20241022'
    } else if (modelName.includes('gpt-4o-mini') || modelName.includes('mini')) {
      modelName = 'claude-3-5-haiku-20241022'
    } else {
      modelName = 'claude-3-5-sonnet-20241022'
    }

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: restMessages,
        system: systemMessage,
        stream: true,
        max_tokens: 4000,
      }),
      signal: opts.signal,
    })

    if (!res.ok || !res.body) {
      throw new Error(`anthropic: ${res.status} ${res.statusText}`)
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
            type?: string
            delta?: { text?: string }
          }
          if (json.type === 'content_block_delta' && json.delta?.text) {
            const chunk = json.delta.text
            full += chunk
            opts.onChunk?.(chunk)
          }
        } catch {
          // ignore
        }
      }
    }
    return full
  }
}

/**
 * Direct Google Gemini client. Used when the client provides a custom Google key.
 */
export class GeminiLlmClient implements LlmClient {
  readonly kind = 'google' as const

  constructor(private readonly apiKey: string) {}

  async complete(opts: CompleteOptions): Promise<string> {
    const systemMessage = opts.messages.find((m) => m.role === 'system')?.content
    const restMessages = opts.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    let modelName = opts.model
    if (modelName.includes('claude') || modelName.includes('frontier') || modelName.includes('sonnet')) {
      modelName = 'gemini-2.5-pro'
    } else {
      modelName = 'gemini-2.5-flash'
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${this.apiKey}`

    const body: any = {
      contents: restMessages,
    }
    if (systemMessage) {
      body.systemInstruction = {
        parts: [{ text: systemMessage }],
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })

    if (!res.ok || !res.body) {
      throw new Error(`google-gemini: ${res.status} ${res.statusText}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let full = ''

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      
      let cleaned = buffer.trim()
      if (cleaned.startsWith('[')) cleaned = cleaned.slice(1)
      if (cleaned.endsWith(']')) cleaned = cleaned.slice(0, -1)
      if (cleaned.startsWith(',')) cleaned = cleaned.slice(1)
      
      const parts = cleaned.split(/},\s*\{/)
      if (parts.length > 1) {
        for (let i = 0; i < parts.length - 1; i++) {
          let part = parts[i]
          if (!part.startsWith('{')) part = '{' + part
          if (!part.endsWith('}')) part = part + '}'
          try {
            const json = JSON.parse(part)
            const text = json.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              full += text
              opts.onChunk?.(text)
            }
          } catch {
            // ignore
          }
        }
        buffer = '{' + (parts[parts.length - 1] ?? '')
      }
    }

    try {
      let finalStr = buffer.trim()
      if (finalStr.startsWith('[')) finalStr = finalStr.slice(1)
      if (finalStr.endsWith(']')) finalStr = finalStr.slice(0, -1)
      if (finalStr.startsWith(',')) finalStr = finalStr.slice(1)
      if (finalStr) {
        const json = JSON.parse(finalStr)
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          full += text
          opts.onChunk?.(text)
        }
      }
    } catch {
      // ignore
    }

    return full
  }
}

export function createLlmClient(
  env: ServerEnv,
  customKeys?: { anthropic?: string; google?: string },
): LlmClient {
  if (customKeys?.anthropic) return new AnthropicLlmClient(customKeys.anthropic)
  if (customKeys?.google) return new GeminiLlmClient(customKeys.google)
  if (env.OPENROUTER_API_KEY) return new OpenRouterLlmClient(env.OPENROUTER_API_KEY)
  return new MockLlmClient()
}
