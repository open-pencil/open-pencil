import { describe, expect, test } from 'bun:test'

import { type FigmaNodeProxy, FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

const createAPI = () => new FigmaAPI(new SceneGraph())

// Recorded in Figma desktop 126 with the same script (2026-10-15).
const NOT_ON_PAGE =
  'in set_devStatus: Cannot set devStatus on a node that is not directly under a page or section'
const UNDER_STATUS =
  'in set_devStatus: Cannot set devStatus on a node inside another node with non-null devStatus'

function setup() {
  const api = createAPI()
  const host = api.createSection()
  const frame = (parent: FigmaNodeProxy, name: string) => {
    const node = api.createFrame()
    node.name = name
    parent.appendChild(node)
    return node
  }
  return { api, host, frame }
}

describe('devStatus', () => {
  test('goes on sections, frames, components, sets and instances on a page or in a section', () => {
    const { api, host, frame } = setup()
    const section = api.createSection()
    host.appendChild(section)
    const component = api.createComponent()
    host.appendChild(component)
    const instance = component.createInstance()
    host.appendChild(instance)
    const variants = [api.createComponent(), api.createComponent()]
    variants[0].name = 'v=1'
    variants[1].name = 'v=2'
    const set = api.combineAsVariants(variants, host)
    const pageFrame = api.createFrame()

    for (const node of [section, frame(host, 'F'), component, instance, set, pageFrame]) {
      node.devStatus = { type: 'READY_FOR_DEV' }
      expect(node.devStatus).toEqual({ type: 'READY_FOR_DEV' })
    }
    expect(() => {
      variants[0].devStatus = { type: 'READY_FOR_DEV' }
    }).toThrow(NOT_ON_PAGE)
  })

  test('is refused inside a frame or a section showing a status', () => {
    const { api, host, frame } = setup()
    const outer = frame(host, 'Outer')
    expect(() => {
      frame(outer, 'Inner').devStatus = { type: 'READY_FOR_DEV' }
    }).toThrow(NOT_ON_PAGE)

    const section = api.createSection()
    host.appendChild(section)
    section.devStatus = { type: 'READY_FOR_DEV' }
    expect(() => {
      frame(section, 'Child').devStatus = { type: 'READY_FOR_DEV' }
    }).toThrow(UNDER_STATUS)
  })

  test('is missing on rectangles and groups, and setting it does nothing', () => {
    const { api, host } = setup()
    const rect = api.createRectangle()
    host.appendChild(rect)
    const group = api.group([api.createRectangle()], host)
    for (const node of [rect, group]) {
      node.devStatus = { type: 'READY_FOR_DEV' }
      expect(node.devStatus).toBeUndefined()
    }
  })

  test('clears with null; a description is not kept, comments hold it', () => {
    const { host, frame } = setup()
    const node = frame(host, 'F')
    node.devStatus = { type: 'COMPLETED', description: 'hello **bold**' }
    expect(node.devStatus).toEqual({ type: 'COMPLETED' })
    node.devStatus = null
    expect(node.devStatus).toBeNull()
  })

  test('hides while the layer cannot show it, and shows again once it can', () => {
    const { api, host, frame } = setup()
    const moved = frame(host, 'Moved')
    moved.devStatus = { type: 'READY_FOR_DEV' }
    const outer = frame(host, 'Outer')
    outer.appendChild(moved)
    expect(moved.devStatus).toBeNull()
    host.appendChild(moved)
    expect(moved.devStatus).toEqual({ type: 'READY_FOR_DEV' })

    const marked = api.createSection()
    host.appendChild(marked)
    marked.devStatus = { type: 'READY_FOR_DEV' }
    const done = frame(host, 'Done')
    done.devStatus = { type: 'COMPLETED' }
    marked.appendChild(done)
    expect(done.devStatus).toBeNull()
    host.appendChild(done)
    expect(done.devStatus).toEqual({ type: 'COMPLETED' })

    const parent = api.createSection()
    host.appendChild(parent)
    const child = frame(parent, 'Child')
    child.devStatus = { type: 'READY_FOR_DEV' }
    parent.devStatus = { type: 'COMPLETED' }
    expect(child.devStatus).toBeNull()
    parent.devStatus = null
    expect(child.devStatus).toEqual({ type: 'READY_FOR_DEV' })

    const wrapped = frame(host, 'Wrapped')
    wrapped.devStatus = { type: 'READY_FOR_DEV' }
    const group = api.group([wrapped], host)
    expect(wrapped.devStatus).toBeNull()
    api.ungroup(group)
    expect(wrapped.devStatus).toEqual({ type: 'READY_FOR_DEV' })
  })

  test('is not copied by clone()', () => {
    const { host, frame } = setup()
    const node = frame(host, 'F')
    node.devStatus = { type: 'READY_FOR_DEV' }
    const copy = node.clone()
    host.appendChild(copy)
    expect(copy.devStatus).toBeNull()
  })
})
