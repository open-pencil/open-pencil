import { es, jsx } from '@open-pencil/emit'

import type { GeneratedKind } from '../model'

/**
 * The Radix primitive a kind renders, from the unified `radix-ui` package, and the component
 * of it each part uses. Its root takes the value two ways (`checked` and `onCheckedChange`,
 * `pressed`, `open`) and `disabled` itself, so the generated props extend the root's.
 */
export const RADIX: Record<
  GeneratedKind,
  { namespace: string; parts: Record<string, string> } | null
> = {
  button: null,
  switch: { namespace: 'Switch', parts: { root: 'Root', thumb: 'Thumb' } },
  checkbox: { namespace: 'Checkbox', parts: { root: 'Root', indicator: 'Indicator' } },
  toggle: { namespace: 'Toggle', parts: { root: 'Root' } },
  collapsible: {
    namespace: 'Collapsible',
    parts: { root: 'Root', trigger: 'Trigger', content: 'Content' }
  },
  tabs: {
    namespace: 'Tabs',
    parts: { root: 'Root', list: 'List', trigger: 'Trigger', content: 'Content' }
  },
  radioGroup: { namespace: 'RadioGroup', parts: { root: 'Root' } },
  toggleGroup: { namespace: 'ToggleGroup', parts: { root: 'Root' } },
  accordion: { namespace: 'Accordion', parts: { root: 'Root' } },
  radioGroupItem: { namespace: 'RadioGroup', parts: { root: 'Item', indicator: 'Indicator' } },
  toggleGroupItem: { namespace: 'ToggleGroup', parts: { root: 'Item' } },
  accordionItem: {
    namespace: 'Accordion',
    parts: { root: 'Item', trigger: 'Trigger', content: 'Content' }
  },
  slider: {
    namespace: 'Slider',
    parts: { root: 'Root', track: 'Track', range: 'Range', thumb: 'Thumb' }
  },
  progress: { namespace: 'Progress', parts: { root: 'Root', indicator: 'Indicator' } },
  // Radix has no number or text field; these are native inputs in the design's own elements.
  numberField: null,
  textField: null,
  textarea: null,
  // A component without a behaviour is the design's own elements.
  plain: null
}

/** What a group's root fixes: one item chosen at a time, and an accordion that can all close. */
export const ROOT_ATTRIBUTES: Partial<Record<GeneratedKind, es.SyntaxNode[]>> = {
  toggleGroup: [jsx.attribute('type', jsx.stringValue('single'))],
  accordion: [jsx.attribute('type', jsx.stringValue('single')), jsx.attribute('collapsible', null)]
}

/** The local name a Radix namespace is imported as: `SwitchPrimitive`. */
export const PRIMITIVE = (namespace: string) => `${namespace}Primitive`

/** `SwitchPrimitive.Root`: a member of an imported Radix namespace, in type position. */
export const qualified = (namespace: string, name: string) => ({
  type: 'TSQualifiedName',
  left: es.identifier(PRIMITIVE(namespace)),
  right: es.identifier(name)
})

/**
 * The props of a group that fixes one choice at a time, without the `type` it fixes. The
 * root's own props join the single and multiple choice, which a single value can't satisfy.
 */
export const SINGLE_PROPS: Partial<Record<GeneratedKind, string>> = {
  toggleGroup: 'ToggleGroupSingleProps',
  accordion: 'AccordionSingleProps'
}

const RADIX_IMPORT = es.parseModule(`import { $Namespace as $Primitive } from 'radix-ui'`)

/** `import { Switch as SwitchPrimitive } from 'radix-ui'` for a kind Radix renders. */
export function radixImport(kind: GeneratedKind): es.SyntaxNode[] {
  const radix = RADIX[kind]
  if (!radix) return []
  return es.fill(RADIX_IMPORT, {
    $Namespace: es.identifier(radix.namespace),
    $Primitive: es.identifier(PRIMITIVE(radix.namespace))
  }).body
}
