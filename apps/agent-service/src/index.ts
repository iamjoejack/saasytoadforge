import 'dotenv/config'
import { buildServer } from './server'

const app = buildServer()
const port = Number(process.env.PORT ?? 8787)

app
  .listen({ port, host: '0.0.0.0' })
  .then((address) => {
    console.log(`agent-service listening on ${address}`)
  })
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
