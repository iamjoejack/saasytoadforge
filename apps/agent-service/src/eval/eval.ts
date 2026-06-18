import { runAgenticEval } from './runner'

// Drives the real agentic loop (runAgentic) so this is a true task-completion scoreboard
// the moment a model key + E2B are configured. With no key it runs on the mock and reports
// that honestly rather than printing a misleading pass rate.
const report = await runAgenticEval()

for (const result of report.results) {
  const detail = result.failures.length ? ` - ${result.failures.join('; ')}` : ''
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${detail}`)
}
console.log(`\n${report.passed}/${report.total} eval cases passed`)
console.log(`model client: ${report.llmKind}   sandbox: ${report.sandboxKind}`)

if (report.llmKind === 'mock' || report.sandboxKind === 'mock') {
  console.log(
    '\nNote: this is not a real baseline. The mock model and mock sandbox cannot complete tasks.\n' +
      'Set a model key (ANTHROPIC_API_KEY or OPENROUTER_API_KEY) and E2B_API_KEY with\n' +
      'SANDBOX_PROVIDER=e2b to measure real task completion.',
  )
}

if (report.passed < report.total) process.exitCode = 1
