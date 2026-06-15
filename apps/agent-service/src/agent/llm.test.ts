import { describe, it, expect } from 'vitest'
import { parseServerEnv } from '@forge/shared'
import { MockLlmClient, createLlmClient } from './llm'

describe('MockLlmClient', () => {
  it('streams chunks and returns the full text', async () => {
    const chunks: string[] = []
    const text = await new MockLlmClient().complete({
      model: 'm',
      messages: [{ role: 'user', content: 'hello world' }],
      onChunk: (c) => chunks.push(c),
    })
    expect(text).toContain('hello world')
    expect(chunks.join('')).toContain('hello world')
  })
})

describe('createLlmClient', () => {
  it('uses the mock client when OPENROUTER_API_KEY is absent', () => {
    expect(createLlmClient(parseServerEnv({})).kind).toBe('mock')
  })

  it('uses the openrouter client when a key is present', () => {
    const env = parseServerEnv({ OPENROUTER_API_KEY: 'sk-test' } as NodeJS.ProcessEnv)
    expect(createLlmClient(env).kind).toBe('openrouter')
  })
})
