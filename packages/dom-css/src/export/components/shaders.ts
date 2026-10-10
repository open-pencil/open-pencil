import type { StateElement } from '#dom-css/behaviours/states/types'

import { es, jsx } from '@open-pencil/emit'
import {
  findLayerByPath,
  shaderOfPaint,
  type SceneGraph,
  type ShaderComponent,
  type ShaderPreset
} from '@open-pencil/scene-graph'

import { isPositioned } from '../projection'
import type { ComponentElement, ComponentNode } from './model'

/** A shader a layer fills with, drawn by the `shaders` library behind the layer's content. */
export interface ShaderLayer {
  preset: ShaderPreset
  /** The readable class the shader's canvas is styled by. */
  className: string
  /** Whether the layer is positioned already, so the shader can be placed inside it. */
  positioned: boolean
}

export function shaderLayer(
  node: StateElement,
  className: string,
  preset: ShaderPreset | undefined
): ShaderLayer | undefined {
  if (!preset) return undefined
  const position = node.base.position
  return {
    preset,
    className: `${className}-shader`,
    positioned: isPositioned(position)
  }
}

/**
 * The shader each element's layer fills with in the rest variant: the topmost visible shader
 * fill, which the component plays behind the layer's content.
 */
export function shaderLayers(
  graph: SceneGraph,
  restId: string,
  elements: readonly StateElement[]
): Map<StateElement, ShaderPreset> {
  const shaders = new Map<StateElement, ShaderPreset>()
  for (const element of elements) {
    const layer = findLayerByPath(graph, restId, element.key.split('\0')[0] ?? '')
    if (!layer) continue
    const shader = layer.fills
      .filter((fill) => fill.visible)
      .map((fill) => shaderOfPaint(layer, fill))
      .findLast((found) => found !== null)
    if (shader) shaders.set(element, shader.preset)
  }
  return shaders
}

/** Whether an effect's name can be imported, as every effect the library has can. */
const isEffectName = (type: string) => /^[A-Za-z_$][\w$]*$/.test(type)

/** The effects of `components` a generated component draws: those it can import by name. */
export const drawnEffects = (components: readonly ShaderComponent[] | undefined) =>
  (components ?? []).filter((component) => isEffectName(component.type))

/**
 * `import { Shader as ShaderCanvas, Aurora as ShaderAurora } from 'shaders/vue'`: the canvas and
 * effects a component draws, under names apart from its own.
 */
export function shaderImport(source: 'shaders/vue' | 'shaders/react', effects: Iterable<string>) {
  const names = ['Shader', ...[...effects].sort()]
  return {
    type: 'ImportDeclaration',
    importKind: 'value',
    specifiers: names.map((name) => ({
      type: 'ImportSpecifier',
      imported: es.identifier(name),
      local: es.identifier(name === 'Shader' ? SHADER_CANVAS : shaderEffectName(name))
    })),
    source: es.string(source)
  }
}

/** The local name a generated component imports effect `type` as, apart from its own names. */
export const shaderEffectName = (type: string) => `Shader${type}`

/** An effect's props as JSX attributes: strings as they are, anything else as JSON. */
export function shaderEffectAttributes(component: ShaderComponent): es.SyntaxNode[] {
  return Object.entries(component.props ?? {}).map(([key, value]) =>
    jsx.attribute(
      key,
      typeof value === 'string' ? jsx.stringValue(value) : jsx.container(es.json(value))
    )
  )
}

/** The local name of the library's `Shader` canvas. */
export const SHADER_CANVAS = 'ShaderCanvas'

/** The elements of a component's tree that fill with a shader. */
function shaderElements(node: ComponentNode): ComponentElement[] {
  if (node.type !== 'element') return []
  return [...(node.shader ? [node] : []), ...node.children.flatMap(shaderElements)]
}

/**
 * The style that puts each shader behind its layer's content: the layer becomes its own
 * stacking context, positioned if it is not already, and the shader fills it beneath
 * everything it holds, clipped to its corners.
 */
export function shaderCSS(tree: ComponentElement): string {
  return shaderElements(tree)
    .flatMap(({ className, shader }) =>
      shader
        ? [
            `.${className} { isolation: isolate;${shader.positioned ? '' : ' position: relative;'} }`,
            `.${shader.className} { position: absolute; inset: 0; z-index: -1; border-radius: inherit; overflow: hidden; pointer-events: none; }`
          ]
        : []
    )
    .join('\n')
}
