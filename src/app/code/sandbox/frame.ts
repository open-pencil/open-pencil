/**
 * The sandbox frame's script (`document.ts`): runs each request from the host in a fresh worker
 * and reports its result. The frame has an opaque origin, so it starts the worker from its
 * bundled source rather than a URL of the app.
 */
import * as v from 'valibot'

import {
  SANDBOX_READY,
  SANDBOX_RESULT,
  sandboxHostMessageSchema,
  sandboxRunResultSchema,
  type SandboxRunResult
} from '@/app/code/sandbox/schema'

import workerSource from './worker/index.ts?script'

const workerURL = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))

addEventListener('message', (event: MessageEvent<unknown>) => {
  const message = v.safeParse(sandboxHostMessageSchema, event.data)
  if (!message.success) return
  const { type: _type, ...request } = message.output
  const worker = new Worker(workerURL)
  const report = (result: SandboxRunResult) => {
    parent.postMessage({ type: SANDBOX_RESULT, ...result }, '*')
    worker.terminate()
  }
  const failed = (): SandboxRunResult => ({
    id: request.id,
    ok: false,
    error: 'Design JSX execution failed.'
  })
  worker.onmessage = ({ data }: MessageEvent<unknown>) => {
    const result = v.safeParse(sandboxRunResultSchema, data)
    report(result.success ? result.output : failed())
  }
  worker.onerror = () => report(failed())
  worker.postMessage(request)
})
parent.postMessage({ type: SANDBOX_READY }, '*')
