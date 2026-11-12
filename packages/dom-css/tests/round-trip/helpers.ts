import { expect } from 'bun:test'

import type { DesignElement, DesignNode } from '@open-pencil/dom-css'
import { sceneGraphToDesignDocument } from '@open-pencil/dom-css/export'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

/** Asserts `node` is a frame and narrows it. */
export function expectFrame(node: SceneNode | undefined) {
  expect(node?.type).toBe('FRAME')
  if (node?.type !== 'FRAME') throw new Error('Expected frame node')
  return node
}

/** Asserts `node` is an element and narrows it. */
export function expectElement(node: DesignNode | undefined): DesignElement {
  expect(node?.type).toBe('element')
  if (node?.type !== 'element') throw new Error('Expected element')
  return node
}

/** The first top-level layer on the graph's first page. */
export function firstLayer(graph: SceneGraph): SceneNode | undefined {
  const page = graph.getPages()[0]
  return page ? graph.getChildren(page.id)[0] : undefined
}

/** The element the first top-level layer exports as, inside its page's element. */
export function exportedFirstLayer(graph: SceneGraph): DesignElement {
  const page = expectElement(sceneGraphToDesignDocument(graph).children[0])
  return expectElement(page.children[0])
}
