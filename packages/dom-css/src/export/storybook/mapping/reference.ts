import { es } from '@open-pencil/emit'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import type { StorybookFile } from '../export'
import { designImages, designParameters } from '../module'
import { mappingArgs, mappingComponent, mappingDefault, mappingState } from './resolve'
import {
  implementationStoryURL,
  type ComponentMapping,
  type ComponentMappings,
  type ComponentMappingArgs
} from './schema'

const MODULE = es.parseModule(`
  import type { $export as Implementation } from '$import'
  export type MappedComponent = typeof Implementation
  type PropsOf<Component> = Component extends new (...args: never[]) => infer Instance
    ? Instance extends { $props: infer Props } ? Props
      : Instance extends { props: infer Props } ? Props : never
    : Component extends (...args: infer Args) => unknown
      ? Args extends [] ? Record<string, never> : Args[0] : never
  type ComponentProps = PropsOf<MappedComponent>
  export const reference = $reference as const
  export default reference
`)

export interface ExportComponentReferenceOptions {
  config: ComponentMappings
  mapping: ComponentMapping
  /** SHA-256 of the original file bytes, not a reserialization of its graph. */
  revision: string
  /** The implementation module's relative import from the emitted reference module. */
  implementationImport: string
  renderDesignImage?: (nodeId: string) => Promise<Uint8Array>
}

/** Validate every target and prop before raster generation or filesystem publication. */
export function validateComponentReference(graph: SceneGraph, mapping: ComponentMapping): void {
  const component = mappingComponent(graph, mapping)
  mappingArgs(graph, component, mappingDefault(graph, component), mapping)
  for (const state of mapping.states)
    mappingArgs(
      graph,
      component,
      mappingState(graph, component, state.designId),
      mapping,
      state.args
    )
}

/** Export only references and assets; the implementation and its stories remain developer-owned. */
export async function exportComponentReference(
  graph: SceneGraph,
  options: ExportComponentReferenceOptions
): Promise<StorybookFile[]> {
  const { config, mapping, revision, implementationImport, renderDesignImage } = options
  if (!/^[a-f0-9]{64}$/.test(revision))
    throw new Error('A component reference requires the original document SHA-256.')
  if (mapping.design.revision && mapping.design.revision !== revision)
    throw new Error(
      `Mapping ${mapping.key} is stale: expected ${mapping.design.revision}, read ${revision}. Review the design and update its revision pin.`
    )
  validateComponentReference(graph, mapping)
  const component = mappingComponent(graph, mapping)
  const pageId = graph.pageOf(component.id)
  const page = (pageId && graph.getNode(pageId)?.name) || ''
  const files: StorybookFile[] = []
  const images: string[] = []
  const reference = async (
    node: SceneNode,
    id: string,
    key: string,
    args: ComponentMappingArgs,
    storyId: string
  ) => {
    const url = new URL('openpencil://open')
    url.searchParams.set('file', mapping.design.file)
    url.searchParams.set('node-id', id)
    url.searchParams.set('revision', revision)
    const image = renderDesignImage ? `${mapping.key}.design/${key}.png` : null
    const imageIndex = images.length
    if (image && renderDesignImage) {
      images.push(image)
      files.push({ path: image, content: await renderDesignImage(node.id), page })
    }
    const parameters = designParameters([
      { type: 'link', url: url.href },
      ...(image ? [{ type: 'image' as const, variant: imageIndex }] : [])
    ])
    const story = {
      id: storyId,
      url: implementationStoryURL(
        config,
        mapping,
        mapping.states.find((state) => state.storyId === storyId)
      )
    }
    return [
      [
        'args',
        es.fill(es.parseExpression('$args satisfies Partial<ComponentProps>'), {
          $args: es.json(args)
        })
      ],
      ['parameters', parameters],
      ['design', es.json({ file: mapping.design.file, id, revision })],
      ['story', es.json(story)]
    ] satisfies [string, es.SyntaxNode][]
  }
  const defaultNode = mappingDefault(graph, component)
  const base = await reference(
    defaultNode,
    mapping.design.id,
    'default',
    mappingArgs(graph, component, defaultNode, mapping),
    mapping.story.id
  )
  const states: [string, es.SyntaxNode][] = []
  for (const state of mapping.states) {
    const node = mappingState(graph, component, state.designId)
    states.push([
      state.key,
      es.object(
        await reference(
          node,
          state.designId,
          state.key,
          mappingArgs(graph, component, node, mapping, state.args),
          state.storyId
        )
      )
    ])
  }
  const referenceObject = es.object([
    ...base,
    ['implementation', es.json(mapping.implementation)],
    ['states', es.object(states)]
  ])
  const body = es.fill(MODULE, {
    $export: es.identifier(mapping.implementation.export),
    $import: es.string(implementationImport),
    $reference: referenceObject
  }).body
  const [importType, ...rest] = body
  // A saved design revision invalidates cached browser references without renaming the assets.
  const imageDeclarations = designImages(images.map((path) => `${path}?revision=${revision}`))
  files.push({
    path: `${mapping.key}.design.ts`,
    content: `// Generated by OpenPencil. Re-export references; implementation and stories are developer-owned.\n${es.printModule({ type: 'Program', sourceType: 'module', body: [importType, ...imageDeclarations, ...rest] })}\n`,
    page
  })
  return files
}
