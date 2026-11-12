import { HEADING_RESET } from '#dom-css/behaviours/reset'
import { stateStylesToCSS } from '#dom-css/behaviours/states/css'
import dedent from 'dedent'
import { compact } from 'es-toolkit/array'
import { omit } from 'es-toolkit/object'
import { camelCase } from 'es-toolkit/string'

import { es, jsx } from '@open-pencil/emit'
import type { ShaderComponent } from '@open-pencil/scene-graph/shaders'

import {
  FIELD_KINDS,
  type ComponentElement,
  type ComponentGenerator,
  type ComponentNode,
  type GeneratedKind
} from '../model'
import type { ComponentReference } from '../references'
import {
  drawnEffects,
  SHADER_CANVAS,
  shaderCSS,
  shaderEffectAttributes,
  shaderEffectName,
  shaderImport,
  type ShaderLayer
} from '../shaders'
import { componentClasses } from '../styling'
import {
  ariaInvalid,
  INPUT_PROPS,
  INVALID_FLAG,
  inputElement,
  NUMBER_STATE,
  partAttributes,
  prepend,
  STEPPERS
} from './fields'
import { PRIMITIVE, RADIX, radixImport, ROOT_ATTRIBUTES, SINGLE_PROPS } from './radix'
import { classValue, drawing, elementLayers, moduleClass, numeric, type MarkupUses } from './shared'
import { defaultOf, parameters, propsType, reactImport, valueArg } from './signature'

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

/** A reference's prop value: a bare name for true, `{false}`, or a string. */
function referenceValue(value: string | boolean): es.SyntaxNode | null {
  if (value === true) return null
  if (value === false) return jsx.container(jsx.literal(false))
  return jsx.stringValue(value)
}

function reference(node: ComponentReference, uses: MarkupUses, depth: number): es.SyntaxNode {
  uses.components.add(node.component)
  return drawing(
    jsx.element(
      node.component,
      [
        jsx.attribute('className', classValue(uses.classOf(node.className))),
        ...node.props.map((prop) => jsx.attribute(prop.name, referenceValue(prop.value))),
        ...(node.model ? [jsx.attribute(defaultOf(node.model), null)] : [])
      ],
      [],
      depth
    ),
    node.layerId,
    uses
  )
}

function element(node: ComponentNode, uses: MarkupUses, depth: number): es.SyntaxNode {
  if (node.type === 'text') return jsx.text(node.value)
  if (node.type === 'textProp') return jsx.container(es.identifier(node.name))
  if (node.type === 'reference') return reference(node, uses, depth)
  if (node.type === 'input')
    return drawing(inputElement(node.className, uses, depth), node.layerId, uses)
  if (node.type === 'icon') {
    uses.icons = true
    return drawing(
      jsx.element(
        ICONIFY,
        [
          jsx.attribute('icon', jsx.stringValue(node.icon)),
          jsx.attribute('className', classValue(uses.classOf(node.className)))
        ],
        [],
        depth
      ),
      node.layerId,
      uses
    )
  }
  return designElement(node, uses, depth)
}

/**
 * The design's own classes, the state styles' module class, and on the root the caller's,
 * which the spread would otherwise lose to the generated one.
 */
function classNameOf(node: ComponentElement, root: boolean, uses: MarkupUses): es.SyntaxNode {
  const classes = [
    ...(node.attrs.class ? [es.string(node.attrs.class)] : []),
    uses.classOf(node.className),
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
    if (binding.type === 'invalid')
      return [
        // The root takes the caller's props before its bindings (`designElement`).
        ...(FIELD_KINDS.has(kind) ? [] : [ariaInvalid(true)]),
        jsx.attribute('data-invalid', jsx.container(INVALID_FLAG()))
      ]
    // Radix sets `data-disabled` on its own roots; a native root needs it for the styles.
    if (binding.type === 'disabled' && native)
      return [jsx.attribute('data-disabled', jsx.container(disabledFlag(kind)))]
    return []
  })
}

/** A shader playing behind its layer's content, with telemetry off, as every export has it. */
function shaderCanvas(shader: ShaderLayer, uses: MarkupUses, depth: number): es.SyntaxNode {
  const effect =
    (at: number) =>
    (component: ShaderComponent): es.SyntaxNode => {
      uses.shaders.add(component.type)
      const children = drawnEffects(component.children).map(effect(at + 1))
      return jsx.element(
        shaderEffectName(component.type),
        shaderEffectAttributes(component),
        children,
        at
      )
    }
  return jsx.element(
    SHADER_CANVAS,
    [
      jsx.attribute('className', classValue(uses.classOf(shader.className))),
      jsx.attribute('disableTelemetry', null)
    ],
    drawnEffects(shader.preset.components).map(effect(depth + 1)),
    depth
  )
}

/** Words alone stay on the element's line, where a line break would add a space. */
function wordsOnly(node: ComponentElement): boolean {
  const only = node.children.length === 1 ? node.children[0]?.type : undefined
  return !node.slot && !node.shader && (only === 'text' || only === 'textProp')
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
    ...(node.disabled ? [jsx.attribute('disabled', null)] : []),
    ...Object.entries(omit(node.attrs, ['class'])).map(([name, value]) =>
      jsx.attribute(name, jsx.stringValue(value))
    ),
    ...partAttributes(node, uses),
    jsx.attribute('className', classValue(classNameOf(node, root, uses))),
    ...bindingAttributes(node, kind, native)
  ]
  const inline = wordsOnly(node)
  // Radix puts an accordion item's trigger in a header, which carries the heading level.
  const header = kind === 'accordionItem' && node.part === 'trigger'
  const childDepth = depth + (header ? 2 : 1)
  const content = node.children.map((child) => element(child, uses, childDepth))
  const shader = node.shader ? [shaderCanvas(node.shader, uses, childDepth)] : []
  const drawn = drawing(
    jsx.element(
      tagOf(node, kind),
      attributes,
      [...shader, ...(node.slot ? [slotContent(node.slot, content, childDepth)] : content)],
      depth + (header ? 1 : 0),
      inline
    ),
    node.layerId,
    uses
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

const ICONIFY_IMPORT = es.parseModule(`import { Icon as ${ICONIFY} } from '@iconify/react'`).body
const IMPORT_COMPONENT = es.parseModule(`import { $Component } from '$path'`)

/**
 * A component as a React component on Radix UI: its parts as Radix primitives from the
 * `radix-ui` package, its variants' state styles in a CSS module, and props that extend the
 * Radix root's with its other variant properties.
 */
export const reactComponent: ComponentGenerator = async (component, options = {}) => {
  const styling = options.styling ?? 'css'
  const stylesPath = `${component.name}.module.css`
  const classOf = componentClasses(component, styling)
  const uses: MarkupUses = {
    component,
    // Styled with Tailwind, a layer's utilities are written out; otherwise its module class.
    classOf: (className) =>
      styling === 'css' ? moduleClass(className) : es.string(classOf(className)),
    kind: component.kind,
    choice: component.choice,
    components: new Set(),
    layers: new WeakMap(),
    icons: false,
    shaders: new Set()
  }
  const body = element(component.tree, uses, 1)
  const imports = [
    ...(uses.icons ? ICONIFY_IMPORT : []),
    ...(uses.shaders.size > 0 ? [shaderImport('shaders/react', uses.shaders)] : []),
    ...radixImport(component.kind),
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
    body: [...react, ...imports, ...(styling === 'css' ? [stylesImport] : []), ...rest]
  }
  // Tailwind styles the markup itself; a CSS module is written beside it otherwise.
  const stylesheet =
    styling === 'css'
      ? [
          {
            path: stylesPath,
            content: compact([
              (await stateStylesToCSS(component.styles)).css,
              shaderCSS(component.tree)
            ]).join('\n')
          }
        ]
      : []
  const model = component.model
  // A group's items are their own component, which the group's markup uses.
  const item = component.item ? await reactComponent(component.item, options) : null
  return {
    files: [
      ...(item?.files ?? []),
      {
        path: `${component.name}.tsx`,
        content: `${jsx.printModule(program)}\n`,
        // The template is filled with copies, so the body, which holds all the JSX, is read.
        layerIds: elementLayers(body, uses.layers)
      },
      ...stylesheet
    ],
    entry: { path: `./${component.name}`, named: true },
    ...valueArg(component.kind, model)
  }
}
