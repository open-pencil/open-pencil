#!/usr/bin/env node

import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { PiHarnessBackend } from '#harness/backends/pi'
import type { HarnessRequest, HarnessSidecarMessage } from '#harness/protocol'
import { parseHarnessRequest } from '#harness/protocol'
import { HarnessSessionService } from '#harness/service'
import { FileResumeStateStore } from '#harness/session-store'

const stateRoot =
  process.env.OPENPENCIL_HARNESS_STATE_DIR ?? join(homedir(), '.open-pencil', 'harness-sessions')
const agentDir = process.env.OPENPENCIL_HARNESS_AGENT_DIR
const apiKey = process.env.OPENPENCIL_HARNESS_API_KEY
const backend = new PiHarnessBackend({
  ...(agentDir ? { agentDir } : {}),
  ...(apiKey ? { apiKey } : {})
})
const service = new HarnessSessionService(
  new Map([[backend.id, backend]]),
  new FileResumeStateStore(stateRoot)
)

async function emit(message: HarnessSidecarMessage): Promise<void> {
  if (process.stdout.write(`${JSON.stringify(message)}\n`)) return
  await new Promise<void>((resolve) => {
    process.stdout.once('drain', resolve)
  })
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function dispatch(line: string): Promise<boolean> {
  let requestId = 'unknown'
  try {
    const request = parseHarnessRequest(line)
    requestId = request.id
    if (request.method === 'service.capabilities') {
      await emit({
        type: 'response',
        id: request.id,
        result: service.capabilities()
      })
      return true
    }
    if (request.method === 'session.create') {
      const result = await service.createSession(
        request.params.sessionId,
        request.params.configuration
      )
      await emit({
        type: 'response',
        id: request.id,
        result: { isResume: result.isResume }
      })
      return true
    }
    if (request.method === 'session.turn') {
      for await (const event of service.runTurn(request.params.sessionId, request.params.prompt)) {
        await emit({ type: 'turn.event', id: request.id, event })
      }
      await emit({ type: 'response', id: request.id, result: { completed: true } })
      return true
    }
    if (request.method === 'session.cancel') {
      service.cancelTurn(request.params.sessionId)
      await emit({ type: 'response', id: request.id, result: { cancelled: true } })
      return true
    }
    if (request.method === 'session.stop') {
      await service.stopSession(request.params.sessionId)
      await emit({ type: 'response', id: request.id, result: { stopped: true } })
      return true
    }
    if (request.method === 'session.destroy') {
      await service.destroySession(request.params.sessionId)
      await emit({ type: 'response', id: request.id, result: { destroyed: true } })
      return true
    }
    await service.shutdown()
    await emit({ type: 'response', id: request.id, result: { shutdown: true } })
    return false
  } catch (error) {
    await emit({ type: 'response', id: requestId, error: messageFor(error) })
    return true
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
let queue = Promise.resolve(true)
const activeTurns = new Set<Promise<boolean>>()
input.on('line', (line) => {
  let request: HarnessRequest | undefined
  try {
    request = parseHarnessRequest(line)
  } catch (error) {
    console.warn('Deferring malformed Harness request to protocol error handling:', error)
  }
  if (request?.method === 'session.turn') {
    const turn = dispatch(line).finally(() => activeTurns.delete(turn))
    activeTurns.add(turn)
    return
  }
  queue = queue.then(async (keepRunning) => {
    if (!keepRunning) return false
    const next = await dispatch(line)
    if (!next) input.close()
    return next
  })
})
let closing: Promise<void> | undefined
async function closeSidecar(): Promise<void> {
  closing ??= queue
    .then(async () => {
      await Promise.allSettled(activeTurns)
      await service.shutdown()
      return undefined
    })
    .catch((error) => {
      process.stderr.write(`${messageFor(error)}\n`)
      process.exitCode = 1
    })
  await closing
}

input.on('close', () => void closeSidecar())
process.on('SIGTERM', () => input.close())
process.on('SIGINT', () => input.close())
