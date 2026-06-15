import { describe, it, expect } from 'vitest'
import { runEval } from './runner'

describe('agent eval harness', () => {
  it('every fixed eval case passes on the mock model', async () => {
    const report = await runEval()
    const failed = report.results.filter((r) => !r.pass)
    expect(failed, JSON.stringify(failed)).toHaveLength(0)
    expect(report.passed).toBe(report.total)
    expect(report.total).toBeGreaterThanOrEqual(3)
  })
})
