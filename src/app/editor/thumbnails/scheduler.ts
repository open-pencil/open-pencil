type ScheduledTask<T> = {
  run: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
  signal?: AbortSignal
  stopListening?: () => void
}

export class ScheduledTaskCancelledError extends Error {
  constructor() {
    super('Scheduled thumbnail task was cancelled')
    this.name = 'ScheduledTaskCancelledError'
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

/**
 * Runs one expensive task at a time, preferring the newest queued request.
 *
 * Scrolling a filmstrip can expose many slides in a few frames. FIFO makes the place the
 * user stops wait behind every slide they passed; LIFO renders that newest viewport first.
 */
export class LatestFirstScheduler<T> {
  private readonly queue: Array<ScheduledTask<T>> = []
  private running = false
  private paused = false

  schedule(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(new ScheduledTaskCancelledError())

    const result = new Promise<T>((resolve, reject) => {
      const task: ScheduledTask<T> = { run, resolve, reject, signal }
      if (signal) {
        const cancel = () => {
          const index = this.queue.indexOf(task)
          if (index === -1) return
          this.queue.splice(index, 1)
          task.stopListening?.()
          reject(new ScheduledTaskCancelledError())
        }
        signal.addEventListener('abort', cancel, { once: true })
        task.stopListening = () => signal.removeEventListener('abort', cancel)
      }
      this.queue.push(task)
    })
    queueMicrotask(() => this.runNext())
    return result
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    if (!paused) this.runNext()
  }

  private runNext(): void {
    if (this.paused || this.running) return
    const task = this.queue.pop()
    if (!task) return
    task.stopListening?.()
    if (task.signal?.aborted) {
      task.reject(new ScheduledTaskCancelledError())
      this.runNext()
      return
    }

    this.running = true
    void task
      .run()
      .then(task.resolve, task.reject)
      .finally(() => {
        this.running = false
        // CanvasKit rendering is synchronous even though the task has a Promise shape.
        // Starting the next raster in the same microtask chain starves scroll and pointer
        // input until the whole queue drains. Give the browser one frame between jobs.
        void yieldToBrowser().then(() => this.runNext())
      })
  }
}
