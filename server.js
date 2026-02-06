import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import app from './src/index.js'

const port = process.env.PORT || 3000

console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
