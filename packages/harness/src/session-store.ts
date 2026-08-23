import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import type { HarnessResumeState } from './backends/types'

const MAX_RESUME_STATE_BYTES = 1024 * 1024
const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/

export interface ResumeStateStore {
  load(sessionId: string): Promise<HarnessResumeState | undefined>
  save(sessionId: string, state: HarnessResumeState): Promise<void>
  remove(sessionId: string): Promise<void>
}

function statePath(root: string, sessionId: string): string {
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new Error('Invalid harness session ID')
  return join(root, `${sessionId}.json`)
}

function isResumeState(value: unknown): value is HarnessResumeState {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false
  if (!('harnessId' in value) || !('specificationVersion' in value) || !('data' in value)) {
    return false
  }
  return (
    value.type === 'resume-session' &&
    typeof value.harnessId === 'string' &&
    value.specificationVersion === 'harness-v1'
  )
}

export class FileResumeStateStore implements ResumeStateStore {
  constructor(private readonly root: string) {}

  async load(sessionId: string): Promise<HarnessResumeState | undefined> {
    const path = statePath(this.root, sessionId)
    try {
      const content = await readFile(path, 'utf8')
      if (Buffer.byteLength(content, 'utf8') > MAX_RESUME_STATE_BYTES) {
        throw new Error('Persisted harness state exceeds the size limit')
      }
      const parsed: unknown = JSON.parse(content)
      if (!isResumeState(parsed)) throw new Error('Persisted harness state is invalid')
      return parsed
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return undefined
      }
      throw error
    }
  }

  async save(sessionId: string, state: HarnessResumeState): Promise<void> {
    const path = statePath(this.root, sessionId)
    const content = JSON.stringify(state)
    if (Buffer.byteLength(content, 'utf8') > MAX_RESUME_STATE_BYTES) {
      throw new Error('Harness state exceeds the persistence size limit')
    }
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporaryPath = `${path}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
    const handle = await open(temporaryPath, 'wx', 0o600)
    try {
      await handle.writeFile(content, 'utf8')
    } finally {
      await handle.close()
    }
    await rename(temporaryPath, path)
  }

  async remove(sessionId: string): Promise<void> {
    await rm(statePath(this.root, sessionId), { force: true })
  }
}
