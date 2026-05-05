import { beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test'

import { computeContentBounds } from '#core/io/formats/raster/render'
import { expectDefined } from '#tests/helpers/assert'
import {
  FIXTURES,
  parseFixture,
  parseGoldPreviewFixture,
  VALID_NODE_TYPES
} from '#tests/helpers/fig-fixtures'
import {
  childMatching,
  childNamed,
  collectAllNodes,
  countByType,
  previewChild
} from '#tests/helpers/fig-traversal'
import { heavy } from '#tests/helpers/test-utils'

import {
  parseFigFile,
  computeAllLayouts,
  exportFigFile,
  importNodeChanges,
  initCodec,
  SceneGraph,
  FigmaAPI,
  type SceneNode,
  type Fill
} from '@open-pencil/core'

setDefaultTimeout(60_000)

describe('edge cases', () => {
  test('non-fig-kiwi bytes throw meaningful error', async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    await expect(parseFigFile(garbage.buffer as ArrayBuffer)).rejects.toThrow()
  })

  test('invalid zip data throws', async () => {
    const garbage = new Uint8Array(50).fill(0xff)
    await expect(parseFigFile(garbage.buffer as ArrayBuffer)).rejects.toThrow()
  })

  test('REMOVED nodes are skipped', async () => {
    const { importNodeChanges } = await import('#core/kiwi/fig/import')
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 1, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Visible',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      },
      {
        guid: { sessionID: 1, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'RECTANGLE',
        name: 'Deleted',
        visible: true,
        opacity: 1,
        phase: 'REMOVED',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      }
    ])
    const children = graph.getChildren(graph.getPages()[0].id)
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('Visible')
  })

  test('symbolOverrides propagate through nested instances', () => {
    // Structure:
    //   DOCUMENT (0:0)
    //   └─ CANVAS "Page" (0:1)
    //       ├─ COMPONENT "Inner" (1:1)    ← inner component
    //       │   └─ TEXT "Label" (1:2)     ← default text "Default"
    //       ├─ COMPONENT "Outer" (1:3)    ← outer component
    //       │   └─ INSTANCE "InnerUse" (1:4) symId=1:1, override: Label→"Changed"
    //       └─ INSTANCE "OuterUse" (1:5)  ← instance of Outer
    //
    // After import, OuterUse should contain a clone of InnerUse,
    // which should contain a Label text with "Changed" (not "Default")
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        phase: 'CREATED'
      } as NodeChange,
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        phase: 'CREATED'
      } as NodeChange,
      // Inner component
      {
        guid: { sessionID: 1, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'Inner',
        phase: 'CREATED',
        size: { x: 100, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      // TEXT child of Inner
      {
        guid: { sessionID: 1, localID: 2 },
        overrideKey: { sessionID: 99, localID: 2 },
        parentIndex: { guid: { sessionID: 1, localID: 1 }, position: '!' },
        type: 'TEXT',
        name: 'Label',
        textData: { characters: 'Default' },
        phase: 'CREATED',
        size: { x: 80, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      // Outer component
      {
        guid: { sessionID: 1, localID: 3 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'SYMBOL',
        name: 'Outer',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      // INSTANCE of Inner inside Outer, with symbolOverride on Label
      {
        guid: { sessionID: 1, localID: 4 },
        parentIndex: { guid: { sessionID: 1, localID: 3 }, position: '!' },
        type: 'INSTANCE',
        name: 'InnerUse',
        phase: 'CREATED',
        size: { x: 100, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 1 },
          symbolOverrides: [
            {
              guidPath: { guids: [{ sessionID: 99, localID: 2 }] },
              textData: { characters: 'Changed' }
            }
          ]
        }
      } as NodeChange,
      // Top-level INSTANCE of Outer on the page
      {
        guid: { sessionID: 1, localID: 5 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'INSTANCE',
        name: 'OuterUse',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 3 }
        }
      } as NodeChange
    ])

    const page = graph.getPages()[0]
    const outerUse = graph.getChildren(page.id).find((n) => n.name === 'OuterUse')
    expect(outerUse).toBeDefined()
    expect(expectDefined(outerUse, 'outerUse').type).toBe('INSTANCE')

    // Walk down: OuterUse > InnerUse clone > Label clone
    const innerClone = graph.getChildren(outerUse?.id ?? '')[0]
    expect(innerClone).toBeDefined()
    expect(innerClone.name).toBe('InnerUse')

    const labelClone = graph.getChildren(innerClone.id)[0]
    expect(labelClone).toBeDefined()
    expect(labelClone.name).toBe('Label')
    expect(labelClone.text).toBe('Changed')
  })

  test('overriddenSymbolID swaps instance component through nested levels', () => {
    // Structure:
    //   COMPONENT "IconA" (1:1) → VECTOR "PathA"
    //   COMPONENT "IconB" (1:3) → VECTOR "PathB1", VECTOR "PathB2"
    //   COMPONENT "Button" (1:5) → INSTANCE "icon" of IconA
    //   COMPONENT "Toolbar" (1:7) → INSTANCE "btn" of Button, with override swapping icon to IconB
    //   INSTANCE "ToolbarUse" (1:9) of Toolbar on the page
    //
    // After import, ToolbarUse > btn clone > icon clone should have IconB's children
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        phase: 'CREATED'
      } as NodeChange,
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        phase: 'CREATED'
      } as NodeChange,
      // IconA component with 1 child
      {
        guid: { sessionID: 1, localID: 1 },
        overrideKey: { sessionID: 90, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'SYMBOL',
        name: 'IconA',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 2 },
        overrideKey: { sessionID: 90, localID: 2 },
        parentIndex: { guid: { sessionID: 1, localID: 1 }, position: '!' },
        type: 'VECTOR',
        name: 'PathA',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      // IconB component with 2 children
      {
        guid: { sessionID: 1, localID: 3 },
        overrideKey: { sessionID: 90, localID: 3 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'SYMBOL',
        name: 'IconB',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 31 },
        overrideKey: { sessionID: 90, localID: 31 },
        parentIndex: { guid: { sessionID: 1, localID: 3 }, position: '!' },
        type: 'VECTOR',
        name: 'PathB1',
        phase: 'CREATED',
        size: { x: 24, y: 12 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 32 },
        overrideKey: { sessionID: 90, localID: 32 },
        parentIndex: { guid: { sessionID: 1, localID: 3 }, position: '"' },
        type: 'VECTOR',
        name: 'PathB2',
        phase: 'CREATED',
        size: { x: 24, y: 12 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      // Button component with instance of IconA
      {
        guid: { sessionID: 1, localID: 5 },
        overrideKey: { sessionID: 90, localID: 5 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '#' },
        type: 'SYMBOL',
        name: 'Button',
        phase: 'CREATED',
        size: { x: 40, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 6 },
        overrideKey: { sessionID: 90, localID: 6 },
        parentIndex: { guid: { sessionID: 1, localID: 5 }, position: '!' },
        type: 'INSTANCE',
        name: 'icon',
        phase: 'CREATED',
        size: { x: 24, y: 24 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: { symbolID: { sessionID: 1, localID: 1 } }
      } as NodeChange,
      // Toolbar component with instance of Button, swapping icon to IconB
      {
        guid: { sessionID: 1, localID: 7 },
        overrideKey: { sessionID: 90, localID: 7 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '$' },
        type: 'SYMBOL',
        name: 'Toolbar',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }
      } as NodeChange,
      {
        guid: { sessionID: 1, localID: 8 },
        overrideKey: { sessionID: 90, localID: 8 },
        parentIndex: { guid: { sessionID: 1, localID: 7 }, position: '!' },
        type: 'INSTANCE',
        name: 'btn',
        phase: 'CREATED',
        size: { x: 40, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 5 },
          symbolOverrides: [
            {
              guidPath: { guids: [{ sessionID: 90, localID: 6 }] },
              overriddenSymbolID: { sessionID: 1, localID: 3 }
            }
          ]
        }
      } as NodeChange,
      // Page-level instance of Toolbar
      {
        guid: { sessionID: 1, localID: 9 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '%' },
        type: 'INSTANCE',
        name: 'ToolbarUse',
        phase: 'CREATED',
        size: { x: 200, y: 40 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        symbolData: {
          symbolID: { sessionID: 1, localID: 7 }
        }
      } as NodeChange
    ])

    const page = graph.getPages()[0]
    const toolbarUse = graph.getChildren(page.id).find((n) => n.name === 'ToolbarUse')
    expect(toolbarUse).toBeDefined()

    // ToolbarUse > btn clone > icon clone
    const btnClone = graph.getChildren(toolbarUse?.id ?? '')[0]
    expect(btnClone).toBeDefined()
    expect(btnClone.name).toBe('btn')

    const iconClone = graph.getChildren(btnClone.id)[0]
    expect(iconClone).toBeDefined()
    expect(iconClone.name).toBe('icon')

    // Icon should have IconB's 2 children, not IconA's 1 child
    const iconChildren = graph.getChildren(iconClone.id)
    expect(iconChildren).toHaveLength(2)
    expect(iconChildren.map((c) => c.name).sort()).toEqual(['PathB1', 'PathB2'])
  })

  test('DSD propagates through intermediate clones that are also DSD-targeted', async () => {
    const graph = await parseFixture('gold-preview.fig')

    const thumb = [...graph.getAllNodes()].find((n) => n.name === 'Preview Thumbnail')
    expect(thumb).toBeDefined()

    let overflows = 0
    function walk(id: string) {
      const node = graph.getNode(id)
      if (!node) return
      if (node.type === 'VECTOR') {
        const parent = graph.getNode(node.parentId)
        if (parent?.type === 'INSTANCE' && parent.width > 0 && parent.height > 0) {
          // Check visibility
          let vis = true
          let cur: typeof node | null = node
          while (cur) {
            if (!cur.visible) {
              vis = false
              break
            }
            cur = cur.parentId ? (graph.getNode(cur.parentId) ?? null) : null
          }
          // Check clipping
          let clipped = false
          cur = graph.getNode(parent.parentId)
          while (cur) {
            if (cur.clipsContent) {
              clipped = true
              break
            }
            cur = cur.parentId ? (graph.getNode(cur.parentId) ?? null) : null
          }
          if (vis && !clipped && node.width > parent.width * 1.2) {
            overflows++
          }
        }
      }
      for (const cid of node.childIds) walk(cid)
    }
    walk(thumb?.id ?? '')
    expect(overflows).toBe(0)
  })
})
