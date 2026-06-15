import { describe, it, expect } from 'vitest'
import { parseServerEnv } from '@forge/shared'
import { modelRouting, modelFor, resolveDeepModel } from './router'

describe('model routing', () => {
  it('reads tiers from env defaults', () => {
    const env = parseServerEnv({})
    expect(modelFor(env, 'fast')).toBe('openai/gpt-4o-mini')
    expect(modelRouting(env).deep).toBe('openrouter/fusion')
  })

  it('uses the deep tier when Fusion is available, else degrades to frontier', () => {
    const env = parseServerEnv({})
    expect(resolveDeepModel(env, { fusionAvailable: true })).toBe('openrouter/fusion')
    expect(resolveDeepModel(env, { fusionAvailable: false })).toBe(modelFor(env, 'frontier'))
  })
})
