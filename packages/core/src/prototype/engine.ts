import type { SceneGraph, SceneNode } from '@lawha/scene-graph'
import { getAbsolutePosition } from '@lawha/scene-graph/coordinate'

import { readInteractions, screenOf, type Action, type Interaction, type Transition } from './model'

export interface OverlayState {
  screen: string
  position: 'center' | 'top' | 'bottom' | 'left' | 'right'
  closeOnOutside: boolean
}

export interface PlayerState {
  screen: string
  /** Screens to return to with Back, most recent last. */
  history: string[]
  overlays: OverlayState[]
}

/** What the player shows after an event: the new state and how to animate into it. */
export interface Step {
  state: PlayerState
  transition: Transition | null
  /** Set when the action leaves the prototype (Open link) or scrolls within a screen. */
  effect?: { type: 'open-url'; url: string } | { type: 'scroll-to'; node: string }
}

export type TriggerType = 'click' | 'hover' | 'press'

export interface Hotspot {
  node: string
  x: number
  y: number
  width: number
  height: number
  triggers: Interaction['trigger']['type'][]
}

const INSTANT: Transition = { type: 'instant', direction: 'left', duration: 0, easing: 'linear' }

export function start(screen: string): PlayerState {
  return { screen, history: [], overlays: [] }
}

/** The screen events go to: the top overlay if one is open, else the current screen. */
export function activeScreen(state: PlayerState): string {
  return state.overlays.at(-1)?.screen ?? state.screen
}

/** Runs an action against a state: what a trigger resolves to, or a timer from `timers`. */
export function fire(graph: SceneGraph, state: PlayerState, action: Action): Step | null {
  switch (action.type) {
    case 'navigate': {
      if (!graph.getNode(action.destination)) return null
      if (action.destination === state.screen && state.overlays.length === 0) return null
      return {
        state: {
          screen: action.destination,
          history: [...state.history, state.screen],
          overlays: []
        },
        transition: action.transition
      }
    }
    case 'back': {
      if (state.overlays.length > 0)
        return {
          state: { ...state, overlays: state.overlays.slice(0, -1) },
          transition: action.transition ?? null
        }
      const previous = state.history.at(-1)
      if (!previous) return null
      return {
        state: { screen: previous, history: state.history.slice(0, -1), overlays: [] },
        transition: action.transition ?? INSTANT
      }
    }
    case 'overlay': {
      if (!graph.getNode(action.destination)) return null
      return {
        state: {
          ...state,
          overlays: [
            ...state.overlays,
            {
              screen: action.destination,
              position: action.position,
              closeOnOutside: action.closeOnOutside
            }
          ]
        },
        transition: action.transition
      }
    }
    case 'close-overlay':
      if (state.overlays.length === 0) return null
      return { state: { ...state, overlays: state.overlays.slice(0, -1) }, transition: null }
    case 'scroll-to':
      return { state, transition: null, effect: { type: 'scroll-to', node: action.destination } }
    case 'open-url':
      return { state, transition: null, effect: { type: 'open-url', url: action.url } }
    default:
      return null
  }
}

/**
 * Handles a pointer trigger on a layer. As in Figma, the event goes to the layer and then its
 * ancestors up to the screen; the nearest one with an interaction for this trigger handles it.
 */
export function trigger(
  graph: SceneGraph,
  state: PlayerState,
  nodeId: string,
  type: TriggerType
): Step | null {
  const screen = activeScreen(state)
  // The layer and its ancestors up to the active screen; a layer elsewhere (under an overlay,
  // or on another screen) takes no events.
  const chain: SceneNode[] = []
  let node: SceneNode | undefined = graph.getNode(nodeId)
  while (node) {
    chain.push(node)
    if (node.id === screen) break
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  if (chain.at(-1)?.id !== screen) return null
  for (const layer of chain) {
    const match = readInteractions(layer).find((i) => i.trigger.type === type)
    if (match) return fire(graph, state, match.action)
  }
  return null
}

/** Handles a key press: the first interaction on the active screen's layers bound to that key. */
export function keyPress(graph: SceneGraph, state: PlayerState, key: string): Step | null {
  for (const node of descendants(graph, activeScreen(state))) {
    const match = readInteractions(node).find(
      (i) => i.trigger.type === 'key' && i.trigger.key.toLowerCase() === key.toLowerCase()
    )
    if (match) return fire(graph, state, match.action)
  }
  return null
}

/** The After-delay interactions of the active screen, each with its delay in ms. */
export function timers(graph: SceneGraph, state: PlayerState): { delay: number; action: Action }[] {
  const out: { delay: number; action: Action }[] = []
  for (const node of descendants(graph, activeScreen(state)))
    for (const i of readInteractions(node))
      if (i.trigger.type === 'after-delay') out.push({ delay: i.trigger.delay, action: i.action })
  return out
}

/** Clicking outside the top overlay closes it when the overlay allows that. */
export function clickOutside(state: PlayerState): Step | null {
  const top = state.overlays.at(-1)
  if (!top?.closeOnOutside) return null
  return { state: { ...state, overlays: state.overlays.slice(0, -1) }, transition: null }
}

function descendants(graph: SceneGraph, rootId: string): SceneNode[] {
  const out: SceneNode[] = []
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node || !node.visible) return
    out.push(node)
    for (const child of node.childIds) walk(child)
  }
  walk(rootId)
  return out
}

/** Where each interactive layer sits on its screen, for the player's clickable areas. */
export function hotspots(graph: SceneGraph, screenId: string): Hotspot[] {
  const screen = graph.getNode(screenId)
  if (!screen) return []
  const origin = getAbsolutePosition(screen, graph)
  const out: Hotspot[] = []
  for (const node of descendants(graph, screenId)) {
    if (node.id === screenId) continue
    const triggers = readInteractions(node)
      .map((i) => i.trigger.type)
      .filter((t) => t === 'click' || t === 'hover' || t === 'press')
    if (triggers.length === 0) continue
    const at = getAbsolutePosition(node, graph)
    out.push({
      node: node.id,
      x: at.x - origin.x,
      y: at.y - origin.y,
      width: node.width,
      height: node.height,
      triggers
    })
  }
  return out
}

/** Every screen reachable from a start screen, following navigate and overlay actions. */
export function reachable(graph: SceneGraph, startId: string, pageId: string): Set<string> {
  const seen = new Set<string>([startId])
  const queue = [startId]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id) break
    for (const node of descendants(graph, id))
      for (const i of readInteractions(node)) {
        const dest = 'destination' in i.action ? i.action.destination : null
        if (!dest || i.action.type === 'scroll-to' || seen.has(dest)) continue
        if (screenOf(graph, dest, pageId)?.id !== dest) continue
        seen.add(dest)
        queue.push(dest)
      }
  }
  return seen
}
