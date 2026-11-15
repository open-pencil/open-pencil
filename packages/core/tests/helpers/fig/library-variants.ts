import type { Editor } from '@open-pencil/core'
import { exportFigFile } from '@open-pencil/core/io/formats/fig'
import { initCodec } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph, type SceneNode } from '@open-pencil/scene-graph'

export const STATES = ['Default', 'Hover', 'Pressed', 'Disabled']
export const KINDS = ['Star', 'Heart', 'Dot']

export function variantSet(graph: SceneGraph, parentId: string, name: string, property: string) {
  return graph.createNode('COMPONENT_SET', parentId, {
    name,
    componentPropertyDefinitions: [
      { id: `${name}:prop`, name: property, type: 'VARIANT', defaultValue: '' }
    ]
  })
}

export function variant(
  graph: SceneGraph,
  setId: string,
  property: string,
  value: string,
  x: number
) {
  const node = graph.createNode('COMPONENT', setId, {
    name: `${property}=${value}`,
    x,
    width: 100,
    height: 40,
    componentPropertyValues: { [property]: value }
  })
  graph.createNode('RECTANGLE', node.id, { name: `${value} fill`, width: 100, height: 40 })
  return node
}

export interface LibraryFileOptions {
  chipName?: (state: string) => string
  /** Chip variants saved with a name and no specs. */
  nameOnly?: boolean
  /** An instance of the first icon on the page too, so the icon set is built at open. */
  iconOnPage?: boolean
  /** A chip state whose variant a library owns, so it cannot be edited here. */
  readOnlyState?: string
}

/**
 * Library sets copied onto the internal canvas: a chip whose instance on the page uses one
 * variant, and whose last variant holds an icon from a second set.
 */
export async function libraryVariantFile({
  chipName = (state) => `State=${state}`,
  nameOnly = false,
  iconOnPage = false,
  readOnlyState
}: LibraryFileOptions = {}): Promise<Uint8Array> {
  await initCodec()
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const internal = graph.addPage('Internal Only Canvas')
  graph.updateNode(internal.id, { internalOnly: true })
  const icons = variantSet(graph, internal.id, 'Icon', 'Kind')
  const iconVariants = KINDS.map((kind, index) =>
    variant(graph, icons.id, 'Kind', kind, index * 120)
  )
  const chip = variantSet(graph, internal.id, 'Chip', 'State')
  const chipVariants = STATES.map((state, index) => {
    const node = variant(graph, chip.id, 'State', state, index * 120)
    graph.updateNode(node.id, { name: chipName(state) })
    if (nameOnly) {
      graph.updateNode(node.id, { componentPropertyValues: {} })
    }
    if (state === readOnlyState) {
      graph.updateNode(node.id, {
        librarySource: {
          identity: { libraryId: 'kit', assetKey: 'chip', revisionId: 'r1' },
          sourceNodeId: null,
          readOnly: true
        }
      })
    }
    return node
  })
  graph.createInstance(iconVariants[0].id, chipVariants[3].id)
  graph.createInstance(chipVariants[0].id, page.id)
  if (iconOnPage) {
    graph.createInstance(iconVariants[0].id, page.id)
  }
  return exportFigFile(graph)
}

export function setNamed(graph: SceneGraph, name: string): SceneNode | undefined {
  return [...graph.nodes.values()].find(
    (node) => node.type === 'COMPONENT_SET' && node.name === name
  )
}

export function builtValues(graph: SceneGraph, setName: string, property: string): string[] {
  const set = setNamed(graph, setName)
  return set
    ? graph.getChildren(set.id).map((node) => node.componentPropertyValues[property] ?? '')
    : []
}

export function allAvailable(values: readonly string[]) {
  return values.map((value) => ({ value, available: true }))
}

export function pageInstance(graph: SceneGraph): SceneNode {
  const instance = graph.getChildren(graph.getPages()[0].id)[0]
  if (instance?.type !== 'INSTANCE') {
    throw new Error('Expected the chip instance')
  }
  return instance
}

export function switchState(editor: Editor, graph: SceneGraph, state: string): SceneNode {
  const instance = pageInstance(graph)
  const [definition] = editor.getInstanceComponentPropertyDefinitions(instance.id)
  editor.setInstanceComponentProperty(instance.id, definition.id, state)
  return pageInstance(graph)
}

export function switchToDisabled(editor: Editor, graph: SceneGraph): SceneNode {
  return switchState(editor, graph, 'Disabled')
}
