import { describe, expect, test } from 'bun:test'

import { SceneGraph, sceneNodeToKiwi } from '@inkly/core'

import { expectDefined, getNodeOrThrow } from '#tests/helpers/assert'

import { ROOT_GUID, pageId } from '../helpers'

describe('Fix 1: auto-layout child transforms', () => {
  test('auto-layout child preserves its stored transform offsets', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'AutoLayout',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 16,
      paddingLeft: 16,
      paddingBottom: 16,
      paddingRight: 16
    })

    graph.createNode('FRAME', parent.id, {
      name: 'Child',
      x: 50,
      y: 100,
      width: 200,
      height: 60
    })

    const blobs: Uint8Array[] = []
    // Serialize the parent — children are serialized recursively
    const changes = sceneNodeToKiwi(
      getNodeOrThrow(graph, parent.id),
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    )

    // changes[0] = parent, changes[1] = child
    const childNc = expectDefined(
      changes.find((nc) => nc.name === 'Child'),
      'child node change'
    )
    expect(childNc).toBeDefined()
    expect(childNc.transform.m02).toBe(50)
    expect(childNc.transform.m12).toBe(100)
  })

  test('absolute-positioned child inside auto-layout keeps its real x/y', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'AutoLayout',
      x: 0,
      y: 0,
      width: 300,
      height: 400,
      layoutMode: 'VERTICAL',
      itemSpacing: 8
    })

    graph.createNode('FRAME', parent.id, {
      name: 'AbsChild',
      x: 75,
      y: 120,
      width: 50,
      height: 50,
      layoutPositioning: 'ABSOLUTE'
    })

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      getNodeOrThrow(graph, parent.id),
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    )

    const absNc = expectDefined(
      changes.find((nc) => nc.name === 'AbsChild'),
      'absolute child node change'
    )
    expect(absNc).toBeDefined()
    expect(absNc.transform.m02).toBe(75)
    expect(absNc.transform.m12).toBe(120)
  })

  test('child in non-auto-layout parent keeps its real x/y', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'PlainFrame',
      x: 0,
      y: 0,
      width: 300,
      height: 400
      // layoutMode defaults to 'NONE'
    })

    graph.createNode('FRAME', parent.id, {
      name: 'Child',
      x: 30,
      y: 45,
      width: 100,
      height: 80
    })

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      getNodeOrThrow(graph, parent.id),
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    )

    const childNc = expectDefined(
      changes.find((nc) => nc.name === 'Child'),
      'child node change'
    )
    expect(childNc).toBeDefined()
    expect(childNc.transform.m02).toBe(30)
    expect(childNc.transform.m12).toBe(45)
  })

  test('preserves imported Figma layout metadata for instance roundtrips', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'Checked List',
      width: 878,
      height: 24,
      layoutMode: 'HORIZONTAL',
      counterAxisSizing: 'HUG',
      layoutAlignSelf: 'STRETCH'
    })
    parent.source.fig.layout = {
      stackMode: 'HORIZONTAL',
      stackPrimarySizing: 'FIXED',
      stackCounterSizing: 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE',
      stackChildAlignSelf: 'STRETCH'
    }

    const child = graph.createNode('INSTANCE', parent.id, {
      name: 'Lists',
      width: 282.6666564941406,
      height: 24,
      layoutMode: 'VERTICAL',
      layoutGrow: 1
    })
    child.source.fig.layout = {
      stackMode: 'VERTICAL',
      stackChildPrimaryGrow: 1
    }

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      getNodeOrThrow(graph, parent.id),
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    )

    const parentNc = expectDefined(
      changes.find((nc) => nc.name === 'Checked List'),
      'parent node change'
    )
    expect(parentNc.stackCounterSizing).toBe('RESIZE_TO_FIT_WITH_IMPLICIT_SIZE')

    const instanceNc = expectDefined(
      changes.find((nc) => nc.name === 'Lists'),
      'instance node change'
    )
    expect(instanceNc.stackMode).toBe('VERTICAL')
    expect(instanceNc.stackChildPrimaryGrow).toBe(1)
    expect(instanceNc.stackPrimarySizing).toBeUndefined()
    expect(instanceNc.stackCounterSizing).toBeUndefined()
    expect(instanceNc.stackPrimaryAlignItems).toBeUndefined()
    expect(instanceNc.stackCounterAlignItems).toBeUndefined()
  })

  test('horizontal auto-layout child also preserves its stored transform offsets', () => {
    const graph = new SceneGraph()
    const parent = graph.createNode('FRAME', pageId(graph), {
      name: 'HorizontalLayout',
      x: 0,
      y: 0,
      width: 600,
      height: 100,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12
    })

    graph.createNode('RECTANGLE', parent.id, {
      name: 'Item',
      x: 200,
      y: 50,
      width: 80,
      height: 80
    })

    const blobs: Uint8Array[] = []
    const changes = sceneNodeToKiwi(
      getNodeOrThrow(graph, parent.id),
      ROOT_GUID,
      0,
      { value: 100 },
      graph,
      blobs
    )

    const itemNc = expectDefined(
      changes.find((nc) => nc.name === 'Item'),
      'item node change'
    )
    expect(itemNc.transform.m02).toBe(200)
    expect(itemNc.transform.m12).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// Fix 2 — frameMaskDisabled always true
// ---------------------------------------------------------------------------
