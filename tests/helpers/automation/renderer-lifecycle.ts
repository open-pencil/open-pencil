import { vi } from 'bun:test'

import type { FigmaAPI } from '@open-pencil/core/figma-api'
import { asDouble } from '@open-pencil/test-support/doubles'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import type { EditorStore } from '@/app/editor/session/create'

export function trackAutomationRenderer(store: EditorStore) {
  const createFigma = makeFigmaFromStore
  createFigma(store)
  const renderer = asDouble<NonNullable<FigmaAPI['renderer']>>({
    invalidateVectorPath: vi.fn()
  })
  const subscribe = store.graph.onNodeEvents.bind(store.graph)
  const active = new Set<() => void>()
  let acquired = 0
  const subscriptions = vi.spyOn(store.graph, 'onNodeEvents').mockImplementation((handlers) => {
    const unsubscribe = subscribe(handlers)
    acquired++
    const release = () => {
      unsubscribe()
      active.delete(release)
    }
    active.add(release)
    return release
  })

  return {
    get active() {
      return active.size
    },
    get acquired() {
      return acquired
    },
    makeFigma(...args: Parameters<typeof makeFigmaFromStore>) {
      const figma = createFigma(...args)
      figma.setRenderer(renderer)
      return figma
    },
    dispose() {
      for (const release of active) release()
      subscriptions.mockRestore()
    }
  }
}

export function installAutomationGlobals() {
  const originals = new Map<string, PropertyDescriptor | undefined>()
  const globals = {
    window: asDouble<Window & typeof globalThis>({
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }),
    document: asDouble<Document>({
      fonts: { add: vi.fn(), ready: Promise.resolve() },
      querySelector: () => null
    })
  }
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  return () => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}
