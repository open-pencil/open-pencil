import type { RunTrace, TraceAsset, TraceStore } from '@/app/ai/chat/trace/types'

/** A `TraceStore` in memory, with its runs and assets open to inspection. */
export function memoryTraceStore() {
  const runs = new Map<string, RunTrace>()
  const assets = new Map<string, TraceAsset>()
  const store: TraceStore = {
    async putRun(run) {
      runs.set(run.runId, run)
    },
    async listRuns(conversationId) {
      return [...runs.values()].filter((run) => run.conversationId === conversationId)
    },
    async putAsset(hash, asset) {
      assets.set(hash, asset)
    },
    async getAsset(hash) {
      return assets.get(hash)
    }
  }
  return { store, runs, assets }
}
