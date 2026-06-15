import { describe, it, expect } from 'vitest'
import { diffLines, unifiedDiff } from './diff'

describe('diffLines', () => {
  it('marks a new file as all additions', () => {
    const lines = diffLines('', 'a\nb')
    expect(lines).toEqual([
      { tag: '+', text: 'a' },
      { tag: '+', text: 'b' },
    ])
  })

  it('keeps common lines as context and marks changes', () => {
    const lines = diffLines('a\nb\nc', 'a\nB\nc')
    expect(lines.map((l) => l.tag + l.text)).toEqual([' a', '-b', '+B', ' c'])
  })

  it('handles pure insertion in the middle', () => {
    const lines = diffLines('a\nc', 'a\nb\nc')
    expect(lines.map((l) => l.tag + l.text)).toEqual([' a', '+b', ' c'])
  })
})

describe('unifiedDiff', () => {
  it('labels a new file and includes added lines', () => {
    const out = unifiedDiff('src/time.js', '', 'export const now = () => Date.now()')
    expect(out).toContain('new file src/time.js')
    expect(out).toContain('--- a/src/time.js')
    expect(out).toContain('+export const now = () => Date.now()')
  })
})
