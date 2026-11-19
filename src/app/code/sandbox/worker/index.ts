/**
 * The sandbox worker's entry, which the frame starts from a `blob:` URL (`frame.ts`). Code it
 * runs reaches no network: the worker's own globals for it are replaced before the first run.
 */
import type { SandboxRunRequest } from '@/app/code/sandbox/schema'

import { runDesignJSX } from './run'

const blocked = () => {
  throw new Error('Network access is unavailable in Design JSX.')
}
Object.defineProperties(self, {
  fetch: { value: blocked },
  XMLHttpRequest: { value: undefined },
  WebSocket: { value: undefined },
  EventSource: { value: undefined },
  importScripts: { value: blocked }
})

self.onmessage = (event: MessageEvent<SandboxRunRequest>) => {
  self.postMessage(runDesignJSX(event.data))
}
