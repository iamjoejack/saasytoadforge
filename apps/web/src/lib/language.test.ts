import { describe, it, expect } from 'vitest'
import { languageFor } from './language'

describe('languageFor', () => {
  it('maps known extensions', () => {
    expect(languageFor('src/index.ts')).toBe('typescript')
    expect(languageFor('a.jsx')).toBe('javascript')
    expect(languageFor('README.md')).toBe('markdown')
    expect(languageFor('config.yaml')).toBe('yaml')
  })

  it('falls back to plaintext for unknown or missing', () => {
    expect(languageFor('LICENSE')).toBe('plaintext')
    expect(languageFor(null)).toBe('plaintext')
  })
})
