import { runEval } from './runner'

const report = await runEval()

for (const result of report.results) {
  const detail = result.failures.length ? ` - ${result.failures.join('; ')}` : ''
  console.log(`${result.pass ? 'PASS' : 'FAIL'}  ${result.name}${detail}`)
}
console.log(`\n${report.passed}/${report.total} eval cases passed`)

if (report.passed < report.total) process.exitCode = 1
