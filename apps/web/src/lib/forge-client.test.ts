import { describe, it, expect } from 'vitest'
import { toWsUrl } from './forge-client'

describe('toWsUrl', () => {
  it('maps http to ws', () => {
    expect(toWsUrl('http://localhost:8787', 'abc')).toBe('ws://localhost:8787/workspaces/abc/shell')
  })

  it('maps https to wss', () => {
    expect(toWsUrl('https://forge.example.com', 'xy')).toBe(
      'wss://forge.example.com/workspaces/xy/shell',
    )
  })
})
