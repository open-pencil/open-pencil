import { promiseTimeout, usePreferredReducedMotion } from '@vueuse/core'
import { onScopeDispose, reactive, ref } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'

import type { EditorCommand } from './terminal-commands'

export interface TerminalEntry {
  id: number
  line: string
  output: string
  failed: boolean
}

const TYPE_TICK_MS = 14
const TYPE_CHARS_PER_TICK = 3

/**
 * Runs commands one at a time against a stage's document, typing each command line out
 * before it executes. `onProgress` fires whenever the transcript grows.
 */
export function useTerminalSession(store: EditorStore, onProgress: () => void) {
  const reducedMotion = usePreferredReducedMotion()
  const entries = reactive<TerminalEntry[]>([])
  const busy = ref(false)

  let disposed = false
  onScopeDispose(() => {
    disposed = true
  })

  async function typeLine(entry: TerminalEntry, line: string): Promise<void> {
    if (reducedMotion.value === 'reduce') return
    for (let offset = 0; offset < line.length; offset += TYPE_CHARS_PER_TICK) {
      if (disposed) return
      entry.line = line.slice(0, offset + TYPE_CHARS_PER_TICK)
      onProgress()
      await promiseTimeout(TYPE_TICK_MS)
    }
  }

  async function run(command: EditorCommand): Promise<void> {
    if (busy.value) return
    busy.value = true
    const entry = reactive<TerminalEntry>({
      id: entries.length,
      line: '',
      output: '',
      failed: false
    })
    entries.push(entry)
    try {
      await typeLine(entry, command.line)
      if (disposed) return
      entry.line = command.line
      entry.output = await command.run(store)
    } catch (error) {
      entry.failed = true
      entry.output = error instanceof Error ? error.message : String(error)
    } finally {
      busy.value = false
      onProgress()
    }
  }

  return { entries, busy, run }
}
