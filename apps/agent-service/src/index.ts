import 'dotenv/config'
import { parseServerEnv } from '@forge/shared'
import { buildServer } from './server'

const env = parseServerEnv()
const app = buildServer()

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then((address) => {
    console.log(`agent-service listening on ${address}`)
  })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })

// Drain connections + let sandboxes clean up on shutdown (e.g. Fly auto-stop).
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}
