import type { ELK, ElkNode } from 'elkjs/lib/elk-api'
import { noop } from 'es-toolkit'

/** A worker a runtime can stop counting as a reason to stay alive, as Bun's can. */
interface Unreffable {
  ref(): void
  unref(): void
}

function unreffable(worker: Worker): (Worker & Unreffable) | null {
  return 'ref' in worker && 'unref' in worker ? (worker as Worker & Unreffable) : null
}

interface Engine {
  elk: ELK
  /** ELK's worker, when it has one the runtime would otherwise wait for. */
  worker: () => Unreffable | null
  /** How ELK's worker failed, which elkjs does not report to the layouts it holds. */
  error: Error | null
  /** Rejects the layouts in flight. */
  waiting: Set<(error: Error) => void>
}

/** Starts ELK's worker, or is `null` where a runtime has no workers and ELK runs in place. */
export type StartElkWorker = (() => Worker) | null

/**
 * ELK in a worker of its own, so a large diagram does not hold up the page, or in place. A
 * worker that fails is dropped, so the next layout starts another.
 */
export function createElkLayout(startWorker: StartElkWorker): (graph: ElkNode) => Promise<ElkNode> {
  let engine: Promise<Engine> | null = null
  /** Layouts in flight. */
  let running = 0

  /** Loads ELK; `drop` forgets it, so the next layout loads it again. */
  async function load(drop: () => void): Promise<Engine> {
    if (!startWorker) {
      const { default: BundledELK } = await import('elkjs/lib/elk.bundled.js')
      return { elk: new BundledELK(), worker: () => null, error: null, waiting: new Set() }
    }
    const { default: WorkerELK } = await import('elkjs/lib/elk-api.js')
    let held: Unreffable | null = null
    const waiting = new Set<(error: Error) => void>()
    const loaded: Engine = {
      elk: new WorkerELK({
        workerFactory: () => {
          const worker = startWorker()
          worker.addEventListener('error', (event) => {
            worker.terminate()
            drop()
            loaded.error = new Error(`ELK's worker failed: ${event.message}`)
            for (const reject of waiting) reject(loaded.error)
            waiting.clear()
          })
          held = unreffable(worker)
          // An idle worker must not keep a script or command from finishing.
          held?.unref()
          return worker
        }
      }),
      worker: () => held,
      error: null,
      waiting
    }
    return loaded
  }

  function elkEngine(): Promise<Engine> {
    if (engine) return engine
    const loading: Promise<Engine> = load(() => {
      if (engine === loading) engine = null
    }).catch((error: unknown) => {
      engine = null
      throw error
    })
    engine = loading
    return loading
  }

  /**
   * Lays `graph` out with the Eclipse Layout Kernel, loaded on first use and kept for later
   * layouts. Its worker, where it has one, keeps the process alive only while a layout runs.
   */
  return async (graph) => {
    const { elk, worker, error, waiting } = await elkEngine()
    if (error) throw error
    let reject: (error: Error) => void = noop
    const failed = new Promise<never>((_, rejectLayout) => {
      reject = rejectLayout
    })
    waiting.add(reject)
    if (running++ === 0) worker()?.ref()
    try {
      return await Promise.race([elk.layout(graph), failed])
    } finally {
      waiting.delete(reject)
      if (--running === 0) worker()?.unref()
    }
  }
}

/** Lays `graph` out with the Eclipse Layout Kernel (`createElkLayout`). */
export const layoutWithElk = createElkLayout(
  typeof Worker === 'undefined'
    ? null
    : () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
)
