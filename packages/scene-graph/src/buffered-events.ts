import { createNanoEvents, type Emitter } from 'nanoevents'

import type { SceneGraphEvents } from './types'

export class CommittedGraphEventError extends AggregateError {
  readonly committed = true

  constructor(errors: readonly unknown[]) {
    super(errors, 'Committed graph event delivery failed')
    this.name = 'CommittedGraphEventError'
  }
}

/** Stable emitter identity with synchronous, nestable event buffering. */
export class BufferedSceneEmitter implements Emitter<SceneGraphEvents> {
  private readonly delegate = createNanoEvents<SceneGraphEvents>()
  private readonly buffers: Array<Array<() => void>> = []

  get events(): Emitter<SceneGraphEvents>['events'] {
    return this.delegate.events
  }

  set events(events: Emitter<SceneGraphEvents>['events']) {
    this.delegate.events = events
  }

  on<K extends keyof SceneGraphEvents>(event: K, listener: SceneGraphEvents[K]) {
    return this.delegate.on(event, listener)
  }

  emit<K extends keyof SceneGraphEvents>(event: K, ...args: Parameters<SceneGraphEvents[K]>): void {
    const buffer = this.buffers.at(-1)
    if (buffer) buffer.push(() => this.delegate.emit(event, ...args))
    else this.delegate.emit(event, ...args)
  }

  /** Buffers events, not mutations. Callers own rollback if the action throws. */
  batch<T>(action: () => T): T {
    const pending: Array<() => void> = []
    this.buffers.push(pending)
    let result: T
    try {
      result = action()
    } catch (error) {
      this.buffers.pop()
      throw error
    }
    this.buffers.pop()
    const outer = this.buffers.at(-1)
    if (outer) outer.push(...pending)
    else {
      const errors: unknown[] = []
      for (const publish of pending) {
        try {
          publish()
        } catch (error) {
          errors.push(error)
        }
      }
      if (errors.length) throw new CommittedGraphEventError(errors)
    }
    return result
  }
}
