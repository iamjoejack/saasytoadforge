import { describe, it, expect } from 'vitest'
import { applyEdit, applyEdits } from './apply-edit'

describe('applyEdit', () => {
  it('replaces an exact multi-line block', () => {
    const before = 'a\nb\nc\n'
    const res = applyEdit(before, { search: 'b\nc', replace: 'B\nC' })
    expect(res.ok && res.contents).toBe('a\nB\nC\n')
    expect(res.ok && res.strategy).toBe('exact')
  })

  it('makes an intra-line substring change', () => {
    const res = applyEdit('const port = 3000', { search: '3000', replace: '8080' })
    expect(res.ok && res.contents).toBe('const port = 8080')
  })

  it('matches when the file has trailing whitespace the search omits', () => {
    const before = 'let a = 1   \nlet b = 2'
    const res = applyEdit(before, {
      search: 'let a = 1\nlet b = 2',
      replace: 'let a = 10\nlet b = 20',
    })
    expect(res.ok && res.contents).toBe('let a = 10\nlet b = 20')
    expect(res.ok && res.strategy).toBe('trim-trailing')
  })

  it('re-indents the replacement when the search is written without indentation', () => {
    const before = 'function f() {\n    const x = 1\n    return x\n}'
    const res = applyEdit(before, {
      search: 'const x = 1\nreturn x',
      replace: 'const y = 2\nreturn y',
    })
    expect(res.ok && res.strategy).toBe('reindent')
    expect(res.ok && res.contents).toBe('function f() {\n    const y = 2\n    return y\n}')
  })

  it('creates content when the search is empty and the file is empty', () => {
    const res = applyEdit('', { search: '', replace: 'hello' })
    expect(res.ok && res.contents).toBe('hello')
    expect(res.ok && res.strategy).toBe('create')
  })

  it('appends when the search is empty and the file has content', () => {
    const res = applyEdit('a', { search: '', replace: 'b' })
    expect(res.ok && res.contents).toBe('a\nb')
    expect(res.ok && res.strategy).toBe('append')
  })

  it('fails with a helpful reason when the search is not found', () => {
    const res = applyEdit('abc', { search: 'zzz', replace: 'q' })
    expect(res.ok).toBe(false)
    expect(!res.ok && res.reason).toContain('not found')
  })

  it('refuses an edit whose search matches more than once', () => {
    const res = applyEdit('x = 1\nx = 1\n', { search: 'x = 1', replace: 'x = 2' })
    expect(res.ok).toBe(false)
    expect(!res.ok && res.reason).toMatch(/more than once/)
  })
})

describe('applyEdits', () => {
  it('applies several edits in order', () => {
    const before = 'x=1\ny=2'
    const res = applyEdits(before, [
      { search: 'x=1', replace: 'x=10' },
      { search: 'y=2', replace: 'y=20' },
    ])
    expect(res.ok && res.contents).toBe('x=10\ny=20')
  })

  it('stops and reports which edit failed', () => {
    const res = applyEdits('x=1', [
      { search: 'x=1', replace: 'x=10' },
      { search: 'missing', replace: 'q' },
    ])
    expect(res.ok).toBe(false)
    expect(!res.ok && res.reason).toContain('edit 2')
  })
})
