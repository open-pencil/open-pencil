import * as v from 'valibot'

import type { SceneGraph, SceneNode } from '@lawha/scene-graph'

import { getPluginData } from '#core/figma-api/plugin-data'

import {
  flowListSchema,
  interactionListSchema,
  type flowSchema,
  type interactionSchema,
  type transitionSchema
} from './schema'

export type Interaction = v.InferOutput<typeof interactionSchema>
export type Transition = v.InferOutput<typeof transitionSchema>
export type Flow = v.InferOutput<typeof flowSchema>
export type Action = Interaction['action']
export type Trigger = Interaction['trigger']

/** Plugin-data keys: interactions live on each layer, flows on the page. */
export const INTERACTIONS_KEY = 'prototype.interactions'
export const FLOWS_KEY = 'prototype.flows'

function parseJSON<T>(text: string, schema: v.GenericSchema<unknown, T>): T | null {
  if (!text) return null
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), text)
  return parsed.success ? parsed.output : null
}

/** A layer's interactions; none when unset or malformed. */
export function readInteractions(node: SceneNode): Interaction[] {
  return parseJSON(getPluginData(node, INTERACTIONS_KEY), interactionListSchema) ?? []
}

/** A page's flows; none when unset or malformed. */
export function readFlows(page: SceneNode): Flow[] {
  return parseJSON(getPluginData(page, FLOWS_KEY), flowListSchema) ?? []
}

/** The screens a prototype moves between: the page's top-level frames, and frames in sections. */
export function screensOf(graph: SceneGraph, pageId: string): SceneNode[] {
  const screens: SceneNode[] = []
  const page = graph.getNode(pageId)
  for (const id of page?.childIds ?? []) {
    const node = graph.getNode(id)
    if (!node || !node.visible) continue
    if (node.type === 'FRAME' || node.type === 'COMPONENT') screens.push(node)
    else if (node.type === 'SECTION')
      for (const childId of node.childIds) {
        const child = graph.getNode(childId)
        if (child && child.visible && (child.type === 'FRAME' || child.type === 'COMPONENT'))
          screens.push(child)
      }
  }
  return screens
}

/** The screen (top-level frame) a layer belongs to. */
export function screenOf(graph: SceneGraph, nodeId: string, pageId: string): SceneNode | null {
  const screens = new Set(screensOf(graph, pageId).map((s) => s.id))
  let node = graph.getNode(nodeId)
  while (node) {
    if (screens.has(node.id)) return node
    node = node.parentId ? graph.getNode(node.parentId) : undefined
  }
  return null
}
