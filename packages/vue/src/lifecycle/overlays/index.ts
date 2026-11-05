import { hasInjectionContext, inject, onScopeDispose, shallowReactive, toValue, watch } from 'vue'
import type { InjectionKey, MaybeRefOrGetter, Plugin } from 'vue'

/**
 * What an open overlay holds back. Every overlay holds back the canvas's keys, such as shortcuts
 * and nudging; a picker, such as a fill or colour picker, leaves undo and redo to the document,
 * as in Figma.
 */
export type OverlayKind = 'overlay' | 'picker'

/** The overlays open in the app: dialogs, menus, lists, popovers, and pickers. */
export interface OpenOverlays {
  /** Whether an open overlay holds back the canvas's keys; `history` asks about undo and redo. */
  holdsKeys(history?: boolean): boolean
}

type OverlayRegistry = OpenOverlays & { open: Map<symbol, OverlayKind> }

const OPEN_OVERLAYS: InjectionKey<OverlayRegistry> = Symbol('open-overlays')

function createOverlayRegistry(): OverlayRegistry {
  const open = shallowReactive(new Map<symbol, OverlayKind>())
  return {
    open,
    holdsKeys(history = false) {
      return [...open.values()].some((kind) => !history || kind !== 'picker')
    }
  }
}

/** Tracks the overlays open in the app, so the canvas can wait while one is open. */
export function createOpenOverlaysPlugin(): Plugin {
  return {
    install(app) {
      app.provide(OPEN_OVERLAYS, createOverlayRegistry())
    }
  }
}

/**
 * Counts an overlay as open while `open` is true, until its scope ends. Outside an app with
 * `createOpenOverlaysPlugin`, as in Storybook, it does nothing.
 */
export function useOverlayOpen(open: MaybeRefOrGetter<boolean>, kind: OverlayKind = 'overlay') {
  const registry = hasInjectionContext() ? inject(OPEN_OVERLAYS, undefined) : undefined
  if (!registry) return
  const id = Symbol('overlay')
  watch(
    () => toValue(open),
    (isOpen) => {
      if (isOpen) registry.open.set(id, kind)
      else registry.open.delete(id)
    },
    { immediate: true, flush: 'sync' }
  )
  onScopeDispose(() => registry.open.delete(id))
}

/** The app's open overlays, or undefined outside an app with `createOpenOverlaysPlugin`. */
export function useOpenOverlays(): OpenOverlays | undefined {
  return hasInjectionContext() ? inject(OPEN_OVERLAYS, undefined) : undefined
}
