import type { Page } from '@playwright/test'

interface BoundFieldScene {
  componentLayer: string
  componentText: string
  plain: string
  plainText: string
  flag: string
  state: string
  size: string
  mode: string
}

type LayerField = 'VISIBLE' | 'TEXT'
const PATHS = { VISIBLE: 'visible', TEXT: 'text' } as const

/**
 * Builds variables of each type, a component with a layer and a text layer, a plain layer and a
 * plain text layer, and reads back what decides a layer's visibility or text. Selection, variable
 * values and typing are fixture setup; binding goes through the panel.
 */
export function boundFieldDriver(page: () => Page) {
  let scene: BoundFieldScene | undefined

  function built() {
    if (!scene) throw new Error('Build the scene first')
    return scene
  }

  return {
    async build() {
      scene = await page().evaluate(() => {
        const store = window.openPencil?.getStore?.()
        if (!store) throw new Error('OpenPencil store not initialized')
        const graph = store.graph
        const pageId = store.state.currentPageId
        // The page is cleared between tests; the variables an earlier test made are not.
        for (const id of graph.variableCollections.keys()) graph.removeCollection(id)
        const collection = graph.createCollection('Flags')
        const flag = graph.createVariable('show-icon', 'BOOLEAN', collection.id, true)
        const state = graph.createVariable('state', 'STRING', collection.id, 'yes')
        const size = graph.createVariable('size', 'FLOAT', collection.id, 4)
        const button = graph.createNode('COMPONENT', pageId, {
          name: 'Button',
          width: 160,
          height: 48
        })
        const badge = graph.createNode('RECTANGLE', button.id, {
          name: 'Badge',
          width: 24,
          height: 24
        })
        const caption = graph.createNode('TEXT', button.id, {
          name: 'Caption',
          text: 'Buy',
          y: 24,
          width: 80,
          height: 20
        })
        const note = graph.createNode('TEXT', pageId, {
          name: 'Note',
          text: 'Note',
          x: 400,
          width: 80,
          height: 20
        })
        const plain = graph.createNode('RECTANGLE', pageId, {
          name: 'Plain',
          x: 300,
          width: 48,
          height: 48
        })
        store.select([plain.id])
        return {
          componentLayer: badge.id,
          componentText: caption.id,
          plain: plain.id,
          plainText: note.id,
          flag: flag.id,
          state: state.id,
          size: size.id,
          mode: collection.defaultModeId
        }
      })
      return scene
    },

    select(layer: 'componentLayer' | 'componentText' | 'plain' | 'plainText') {
      return page().evaluate((id) => window.openPencil?.getStore?.().select([id]), built()[layer])
    },

    setText(text: string) {
      const { state, mode } = built()
      return page().evaluate(
        (args) =>
          window.openPencil?.getStore?.().updateVariableValue(args.state, args.mode, args.text),
        { state, mode, text }
      )
    },

    setSize(size: number) {
      const { size: id, mode } = built()
      return page().evaluate(
        (args) =>
          window.openPencil?.getStore?.().updateVariableValue(args.id, args.mode, args.size),
        { id, mode, size }
      )
    },

    /** What decides a layer field: the layer's value, its variable, and its component property. */
    layer(id: string, field: LayerField = 'VISIBLE') {
      return page().evaluate(
        ({ nodeId, field, path }) => {
          const node = window.openPencil?.getStore?.().graph.getNode(nodeId)
          return {
            visible: node?.visible,
            text: node?.text,
            variable: node?.boundVariables[path],
            property: node?.componentPropertyReferences.find((item) => item.field === field)
              ?.propertyId
          }
        },
        { nodeId: id, field, path: PATHS[field] }
      )
    }
  }
}
