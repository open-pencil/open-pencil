import { layerClassNames } from '#dom-css/behaviours/states/names'
import { stateTailwindClasses } from '#dom-css/behaviours/states/tailwind'

import type { ComponentElement, ComponentModel, ComponentNode } from './model'

/** How a generated component is styled: a stylesheet, or Tailwind utilities in its markup. */
export const COMPONENT_STYLINGS = ['css', 'tailwind'] as const
export type ComponentStyling = (typeof COMPONENT_STYLINGS)[number]

/** Where a layer's shader plays: filling the layer, beneath its content, inside its corners. */
export const SHADER_UTILITIES = 'pointer-events-none absolute inset-0 -z-10 rounded-[inherit]'

function shaderElements(node: ComponentNode): ComponentElement[] {
  if (node.type !== 'element') return []
  return [...(node.shader ? [node] : []), ...node.children.flatMap(shaderElements)]
}

/**
 * The class each of a component's readable class names stands for. Styled with a stylesheet, a
 * class is itself; with Tailwind it is the layer's utilities, its states behind their variants,
 * and a shader canvas's placement.
 */
export function componentClasses(
  component: ComponentModel,
  styling: ComponentStyling
): (className: string) => string {
  if (styling === 'css') return (className) => className
  const readable = layerClassNames(component.styles)
  const utilities = stateTailwindClasses(component.styles)
  const byClass = new Map<string, string>()
  for (const [element, className] of readable) byClass.set(className, utilities.get(element) ?? '')
  for (const { shader } of shaderElements(component.tree))
    if (shader) byClass.set(shader.className, SHADER_UTILITIES)
  return (className) => byClass.get(className) ?? className
}
