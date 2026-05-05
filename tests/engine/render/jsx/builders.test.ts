import { describe, expect, it } from 'bun:test'

import { Frame, Text, Rectangle, isTreeNode, node } from '@open-pencil/core'

import { expectDefined } from '../../../helpers/assert'

describe('TreeNode builders', () => {
  it('creates Frame tree node', () => {
    const tree = Frame({ name: 'Card', w: 320, h: 200, bg: '#FFF' })
    expect(isTreeNode(tree)).toBe(true)
    expect(tree.type).toBe('frame')
    expect(tree.props.name).toBe('Card')
    expect(tree.props.w).toBe(320)
    expect(tree.children).toEqual([])
  })

  it('creates Text tree node with string child', () => {
    const tree = Text({ name: 'Title', size: 18, children: 'Hello World' })
    expect(tree.type).toBe('text')
    expect(tree.children).toEqual(['Hello World'])
  })

  it('creates nested tree', () => {
    const tree = Frame({
      name: 'Card',
      children: [
        Rectangle({ name: 'Bg', w: 100, h: 100, bg: '#E5E7EB' }),
        Text({ name: 'Label', size: 14, children: 'Click me' })
      ]
    })
    expect(tree.children.length).toBe(2)
    expect(isTreeNode(expectDefined(tree.children[0], 'first tree child'))).toBe(true)
    const bg = tree.children[0] as ReturnType<typeof Rectangle>
    expect(bg.type).toBe('rectangle')
    expect(bg.props.name).toBe('Bg')
  })

  it('node() flattens nested arrays', () => {
    const tree = node('frame', {
      children: [[Text({ children: 'A' }), Text({ children: 'B' })], Text({ children: 'C' })]
    })
    expect(tree.children.length).toBe(3)
  })

  it('node() filters null/undefined children', () => {
    const tree = node('frame', {
      children: [null, Text({ children: 'A' }), undefined]
    })
    expect(tree.children.length).toBe(1)
  })
})
