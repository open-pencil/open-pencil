import { HEADING_RESET } from '#dom-css/behaviours/reset'
import { stateStylesToCSS } from '#dom-css/behaviours/states/css'
import dedent from 'dedent'
import { omit } from 'es-toolkit/object'
import { camelCase, upperFirst } from 'es-toolkit/string'

import { es, jsx } from '@open-pencil/emit'

import type {
  ComponentElement,
  ComponentGenerator,
  GeneratedComponent,
  ComponentModel,
  ComponentNode,
  GeneratedKind
} from '../model'
import type { ComponentReference } from '../references'
import {
  INPUT_PROPS,
  inputElement,
  kindParameters,
  NUMBER_STATE,
  partAttributes,
  prepend,
  STEPPERS,
  type Parameter
} from './fields'
import { moduleClass, numeric, type MarkupUses } from './shared'

/**
 * The Radix primitive a kind renders, from the unified `radix-ui` package, and the component
 * of it each part uses. Its root takes the value two ways (`checked` and `onCheckedChange`,
 * `pressed`, `open`) and `disabled` itself, so the generated props extend the root's.
 */
const RADIX: Record<GeneratedKind, { namespace: string; parts: Record<string, string> } | null> = {
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
const ROOT_ATTRIBUTES: Partial<Record<GeneratedKind, es.SyntaxNode[]>> = {
  toggleGroup: [jsx.attribute('type', jsx.stringValue('single'))],
  accordion: [jsx.attribute('type', jsx.stringValue('single')), jsx.attribute('collapsible', null)]
}

const PRIMITIVE = (namespace: string) => `${namespace}Primitive`

const HEADING_STYLE = jsx.container(
  es.object(
    Object.entries(HEADING_RESET).map(
      ([property, value]) => [camelCase(property), es.string(value)] as const
    )
  )
)

/** Several classes on one element, skipping a caller's that is absent. */
const CLASS_NAMES = es.parseExpression("$classes.filter(Boolean).join(' ')")

/** Whether a layer renders as a native button: a button's root, or a number field's stepper. */
const isNativeButton = (node: ComponentElement, kind: GeneratedKind) =>
  (kind === 'button' && node.part === 'root') ||
  (kind === 'numberField' && node.part !== null && Object.hasOwn(STEPPERS, node.part))

/** A Radix primitive's part, a native button, or the design's tag. */
function tagOf(node: ComponentElement, kind: GeneratedKind): string {
  const radix = RADIX[kind]
  const part = node.part ? radix?.parts[node.part] : undefined
  if (radix && part) return `${PRIMITIVE(radix.namespace)}.${part}`
  return isNativeButton(node, kind) ? 'button' : node.tag
}

/** `disabled || undefined`, so a native root sets `data-disabled` only while disabled. */
const disabledFlag = (kind: GeneratedKind) =>
  es.parseExpression(
    kind === 'numberField' ? 'disabled || undefined' : 'props.disabled || undefined'
  )

/** The Iconify component, named apart from any component the design calls `Icon`. */
const ICONIFY = 'IconifyIcon'

/** `defaultChecked`: Radix's uncontrolled value, which a nested control starts from. */
const defaultOf = (model: string) => `default${upperFirst(model)}`

/** A reference's prop value: a bare name for true, `{false}`, or a string. */
function referenceValue(value: string | boolean): es.SyntaxNode | null {
  if (value === true) return null
  if (value === false) return jsx.container(jsx.literal(false))
  return jsx.stringValue(value)
}

function reference(node: ComponentReference, uses: MarkupUses, depth: number): es.SyntaxNode {
  uses.components.add(node.component)
  return jsx.element(
    node.component,
    [
      jsx.attribute('className', jsx.container(moduleClass(node.className))),
      ...node.props.map((prop) => jsx.attribute(prop.name, referenceValue(prop.value))),
      ...(node.model ? [jsx.attribute(defaultOf(node.model), null)] : [])
    ],
    [],
    depth
  )
}

function element(node: ComponentNode, uses: MarkupUses, depth: number): es.SyntaxNode {
  if (node.type === 'text') return jsx.text(node.value)
  if (node.type === 'textProp') return jsx.container(es.identifier(node.name))
  if (node.type === 'reference') return reference(node, uses, depth)
  if (node.type === 'input') return inputElement(node.className, uses, depth)
  if (node.type === 'icon') {
    uses.icons = true
    return jsx.element(
      ICONIFY,
      [
        jsx.attribute('icon', jsx.stringValue(node.icon)),
        jsx.attribute('className', jsx.container(moduleClass(node.className)))
      ],
      [],
      depth
    )
  }
  return designElement(node, uses, depth)
}

/**
 * The design's own classes, the state styles' module class, and on the root the caller's,
 * which the spread would otherwise lose to the generated one.
 */
function classNameOf(node: ComponentElement, root: boolean): es.SyntaxNode {
  const classes = [
    ...(node.attrs.class ? [es.string(node.attrs.class)] : []),
    moduleClass(node.className),
    ...(root ? [es.parseExpression('props.className')] : [])
  ]
  const only = classes.length === 1 ? classes.at(0) : undefined
  return only ?? es.fill(CLASS_NAMES, { $classes: es.array(classes) })
}

/**
 * What a root fixes before the caller's props: a group's single choice and its start, and a
 * slider's or progress bar's range and the value it starts at.
 */
function rootAttributes(uses: MarkupUses): es.SyntaxNode[] {
  const { component } = uses
  const start = uses.choice?.default
  const { range } = component
  return [
    ...(ROOT_ATTRIBUTES[uses.kind] ?? []),
    // A choice starts on the design's option, which the caller's props can change.
    ...(start ? [jsx.attribute('defaultValue', jsx.stringValue(start))] : []),
    ...(range && uses.kind === 'slider'
      ? [
          jsx.attribute('defaultValue', jsx.container(es.array([es.number(range.default)]))),
          numeric('min', range.min),
          numeric('max', range.max),
          numeric('step', range.step)
        ]
      : []),
    ...(range && uses.kind === 'progress'
      ? [
          // Radix takes a value within its range, as the indicator draws one.
          jsx.attribute(
            'value',
            jsx.container(
              es.fill(es.parseExpression('Math.min($max, Math.max($min, value))'), {
                $min: es.number(range.min),
                $max: es.number(range.max)
              })
            )
          ),
          numeric('max', range.max)
        ]
      : [])
  ]
}

function bindingAttributes(
  node: ComponentElement,
  kind: GeneratedKind,
  native: boolean
): es.SyntaxNode[] {
  return node.bindings.flatMap((binding) => {
    if (binding.type === 'prop')
      return [jsx.attribute(binding.attribute, jsx.container(es.identifier(binding.prop.name)))]
    // Radix sets `data-disabled` on its own roots; a native root needs it for the styles.
    if (binding.type === 'disabled' && native)
      return [jsx.attribute('data-disabled', jsx.container(disabledFlag(kind)))]
    return []
  })
}

function designElement(node: ComponentElement, uses: MarkupUses, depth: number): es.SyntaxNode {
  const kind = uses.kind
  const root = node.part === 'root'
  const native = root && !(node.part && RADIX[kind]?.parts[node.part])
  const attributes = [
    ...(isNativeButton(node, kind) ? [jsx.attribute('type', jsx.stringValue('button'))] : []),
    ...(root ? rootAttributes(uses) : []),
    // The root passes the caller's props on, such as `checked` or `onClick`, unless its input
    // takes them.
    ...(root && !INPUT_PROPS[kind] ? [jsx.spread(es.identifier('props'))] : []),
    ...(node.value === undefined ? [] : [jsx.attribute('value', jsx.stringValue(node.value))]),
    ...Object.entries(omit(node.attrs, ['class'])).map(([name, value]) =>
      jsx.attribute(name, jsx.stringValue(value))
    ),
    ...partAttributes(node, uses),
    jsx.attribute('className', jsx.container(classNameOf(node, root))),
    ...bindingAttributes(node, kind, native)
  ]
  // Words alone stay on the element's line, where a line break would add a space.
  const only = node.children.length === 1 ? node.children[0]?.type : undefined
  const inline = !node.slot && (only === 'text' || only === 'textProp')
  // Radix puts an accordion item's trigger in a header, which carries the heading level.
  const header = kind === 'accordionItem' && node.part === 'trigger'
  const childDepth = depth + (header ? 2 : 1)
  const children = node.children.map((child) => element(child, uses, childDepth))
  const drawn = jsx.element(
    tagOf(node, kind),
    attributes,
    node.slot ? [slotContent(node.slot, children, childDepth)] : children,
    depth + (header ? 1 : 0),
    inline
  )
  const shown = header
    ? jsx.element(
        `${PRIMITIVE('Accordion')}.Header`,
        [jsx.attribute('style', HEADING_STYLE)],
        [drawn],
        depth
      )
    : drawn
  return node.shownBy ? whenShown(node.shownBy, shown) : shown
}

const LOGICAL = (operator: '&&' | '??', left: es.SyntaxNode, right: es.SyntaxNode) => ({
  type: 'LogicalExpression',
  operator,
  left,
  right
})

/** `{content ?? <>…</>}`: what the caller passes for a slot, or the design's content. */
function slotContent(slot: string, children: es.SyntaxNode[], depth: number): es.SyntaxNode {
  return jsx.container(LOGICAL('??', es.identifier(slot), jsx.fragment(children, depth)))
}

/** `{showIcon && <…/>}`: a layer a boolean prop shows. */
function whenShown(prop: string, drawn: es.SyntaxNode): es.SyntaxNode {
  return jsx.container(LOGICAL('&&', es.identifier(prop), drawn))
}

const MODULE = es.parseModule(dedent`
  import type { ComponentProps } from 'react'

  import styles from '$styles'

  export type $Props = $Type

  export function $Name($params: $Props) {
    return $body
  }
`)

const RADIX_IMPORT = es.parseModule(`import { $Namespace as $Primitive } from 'radix-ui'`)
const ICONIFY_IMPORT = es.parseModule(`import { Icon as ${ICONIFY} } from '@iconify/react'`).body
const IMPORT_COMPONENT = es.parseModule(`import { $Component } from '$path'`)

/**
 * The props of a group that fixes one choice at a time, without the `type` it fixes. The
 * root's own props join the single and multiple choice, which a single value can't satisfy.
 */
const SINGLE_PROPS: Partial<Record<GeneratedKind, string>> = {
  toggleGroup: 'ToggleGroupSingleProps',
  accordion: 'AccordionSingleProps'
}

const qualified = (namespace: string, name: string) => ({
  type: 'TSQualifiedName',
  left: es.identifier(PRIMITIVE(namespace)),
  right: es.identifier(name)
})

/** Props a kind declares itself, where no Radix root has them. */
const OWN_PROPS: Partial<Record<GeneratedKind, string>> = {
  progress: "Omit<ComponentProps<typeof ProgressPrimitive.Root>, 'value'> & { value?: number }",
  numberField:
    "Omit<ComponentProps<'div'>, 'defaultValue' | 'onChange'> & { defaultValue?: number; onValueChange?: (value: number) => void; disabled?: boolean }",
  textField: "ComponentProps<'input'>",
  textarea: "ComponentProps<'textarea'>"
}

/** The root's own props, or a single choice group's. */
function rootPropsType(kind: GeneratedKind, tag: string): es.SyntaxNode {
  const own = OWN_PROPS[kind]
  if (own) return es.parseType(own)
  // A component without a behaviour takes its root element's props.
  if (kind === 'plain') return es.parseType(`ComponentProps<'${tag}'>`)
  const radix = RADIX[kind]
  if (!radix) return es.parseType("ComponentProps<'button'>")
  const single = SINGLE_PROPS[kind]
  if (single)
    return es.fill(es.parseType("Omit<$Props, 'type'>"), {
      $Props: qualified(radix.namespace, single)
    })
  return es.fill(es.parseType('ComponentProps<typeof $Root>'), {
    $Root: qualified(radix.namespace, radix.parts.root)
  })
}

/** The root's own props, extended with the component's variant props when it has any. */
function propsType(component: ComponentModel): es.SyntaxNode {
  const base = rootPropsType(component.kind, component.tree.tag)
  const own = [component.props, component.texts, component.booleans, component.slots]
  if (own.every((list) => list.length === 0)) return base
  return {
    type: 'TSIntersectionType',
    types: [
      base,
      es.objectType([
        ...component.props.map((prop): [string, es.SyntaxNode, boolean] => [
          prop.name,
          es.stringUnionType(prop.options),
          true
        ]),
        ...component.texts.map((text): [string, es.SyntaxNode, boolean] => [
          text.name,
          es.parseType('string'),
          true
        ]),
        ...component.booleans.map((prop): [string, es.SyntaxNode, boolean] => [
          prop.name,
          es.parseType('boolean'),
          true
        ]),
        ...component.slots.map((slot): [string, es.SyntaxNode, boolean] => [
          slot.name,
          es.parseType('ReactNode'),
          true
        ])
      ])
    ]
  }
}

/**
 * `{ size = 'Small', label = 'Save', ...props }`: variant and text props with their defaults,
 * kept off the root, and the rest passed on.
 */
function parameters(component: ComponentModel): es.SyntaxNode {
  const own: Parameter[] = [
    ...kindParameters(component),
    ...[...component.props, ...component.texts].map((prop) => ({
      name: prop.name,
      default: es.string(prop.default)
    })),
    ...component.booleans.map((prop) => ({
      name: prop.name,
      default: es.parseExpression(String(prop.default))
    })),
    // Slots are kept off the root too, which would otherwise get them as attributes.
    ...component.slots.map((slot) => ({ name: slot.name }))
  ]
  if (own.length === 0) return es.identifier('props')
  return {
    type: 'ObjectPattern',
    properties: [
      ...own.map((prop) => ({
        type: 'Property',
        kind: 'init',
        key: es.identifier(prop.name),
        value: prop.default
          ? { type: 'AssignmentPattern', left: es.identifier(prop.name), right: prop.default }
          : es.identifier(prop.name),
        computed: false,
        method: false,
        shorthand: true
      })),
      { type: 'RestElement', argument: es.identifier('props') }
    ]
  }
}

/**
 * `import { useState, type ComponentProps, type ReactNode } from 'react'` with only what the
 * component uses: a number field's state, its root's props, and its slots' content.
 */
function reactImport(uses: { state: boolean; props: boolean; slots: boolean }): es.SyntaxNode[] {
  const types = [...(uses.props ? ['ComponentProps'] : []), ...(uses.slots ? ['ReactNode'] : [])]
  if (!uses.state && types.length === 0) return []
  const specifiers = uses.state
    ? ['useState', ...types.map((name) => `type ${name}`)].join(', ')
    : types.join(', ')
  return es.parseModule(`import ${uses.state ? '' : 'type '}{ ${specifiers} } from 'react'`).body
}

/**
 * The prop a story sets the value with: Radix's uncontrolled value, so a story's control and
 * its play function can both change it, which a slider takes as a list; a progress bar's own
 * value, which nothing else changes.
 */
function valueArg(
  kind: GeneratedKind,
  model: string | null
): Pick<GeneratedComponent, 'valueArg' | 'valueList'> {
  if (!model) return { valueArg: null }
  if (kind === 'progress') return { valueArg: 'value' }
  return { valueArg: defaultOf(model), ...(kind === 'slider' ? { valueList: true } : {}) }
}

/**
 * A component as a React component on Radix UI: its parts as Radix primitives from the
 * `radix-ui` package, its variants' state styles in a CSS module, and props that extend the
 * Radix root's with its other variant properties.
 */
export const reactComponent: ComponentGenerator = async (component) => {
  const radix = RADIX[component.kind]
  const stylesPath = `${component.name}.module.css`
  const uses: MarkupUses = {
    component,
    kind: component.kind,
    choice: component.choice,
    components: new Set(),
    icons: false
  }
  const body = element(component.tree, uses, 1)
  const imports = [
    ...(uses.icons ? ICONIFY_IMPORT : []),
    ...(radix
      ? es.fill(RADIX_IMPORT, {
          $Namespace: es.identifier(radix.namespace),
          $Primitive: es.identifier(PRIMITIVE(radix.namespace))
        }).body
      : []),
    ...[...uses.components].sort().flatMap(
      (name) =>
        es.fill(IMPORT_COMPONENT, {
          $Component: es.identifier(name),
          $path: es.string(`./${name}`)
        }).body
    )
  ]
  const [, stylesImport, ...rest] = es.fill(MODULE, {
    $styles: es.string(`./${stylesPath}`),
    $Props: es.identifier(`${component.name}Props`),
    $Type: propsType(component),
    $Name: es.identifier(component.name),
    $params: parameters(component),
    $body: body
  }).body
  const state =
    component.kind === 'numberField' && component.range ? NUMBER_STATE(component.range) : []
  prepend(rest.at(-1), state)
  const react = reactImport({
    state: state.length > 0,
    // A single choice group's props come from Radix's own type, not `ComponentProps`.
    props: !SINGLE_PROPS[component.kind],
    slots: component.slots.length > 0
  })
  const program = {
    type: 'Program',
    sourceType: 'module',
    body: [...react, ...imports, stylesImport, ...rest]
  }
  const { css } = await stateStylesToCSS(component.styles)
  const model = component.model
  // A group's items are their own component, which the group's markup uses.
  const item = component.item ? await reactComponent(component.item) : null
  return {
    files: [
      ...(item?.files ?? []),
      { path: `${component.name}.tsx`, content: `${jsx.printModule(program)}\n` },
      { path: stylesPath, content: css }
    ],
    entry: { path: `./${component.name}`, named: true },
    ...valueArg(component.kind, model)
  }
}
