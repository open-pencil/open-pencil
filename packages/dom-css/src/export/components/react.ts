import { stateStylesToCSS } from '#dom-css/behaviours/states/css'
import dedent from 'dedent'
import { omit } from 'es-toolkit/object'
import { upperFirst } from 'es-toolkit/string'

import { es, jsx } from '@open-pencil/emit'

import type {
  ComponentElement,
  ComponentGenerator,
  ComponentModel,
  ComponentNode,
  GeneratedKind
} from './model'
import type { ComponentReference } from './references'

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
  }
}

const PRIMITIVE = (namespace: string) => `${namespace}Primitive`

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** `styles.thumb`, or `styles['switch-thumb']` for a class that isn't an identifier. */
function moduleClass(className: string): es.SyntaxNode {
  return {
    type: 'MemberExpression',
    object: es.identifier('styles'),
    property: IDENTIFIER.test(className) ? es.identifier(className) : es.string(className),
    computed: !IDENTIFIER.test(className),
    optional: false
  }
}

/** Several classes on one element, skipping a caller's that is absent. */
const CLASS_NAMES = es.parseExpression("$classes.filter(Boolean).join(' ')")

/** A Radix primitive's part, a native button for a root without one, or the design's tag. */
function tagOf(node: ComponentElement, kind: GeneratedKind): string {
  const radix = RADIX[kind]
  const part = node.part ? radix?.parts[node.part] : undefined
  if (radix && part) return `${PRIMITIVE(radix.namespace)}.${part}`
  return node.part === 'root' ? 'button' : node.tag
}

/** `props.disabled || undefined`, so a native button sets `data-disabled` only while disabled. */
const DISABLED_FLAG = es.parseExpression('props.disabled || undefined')

/** What a component's markup uses, which its module imports. */
interface MarkupUses {
  kind: GeneratedKind
  /** Other generated components. */
  components: Set<string>
  icons: boolean
}

/** The Iconify component, named apart from any component the design calls `Icon`. */
const ICONIFY = 'IconifyIcon'

/** `defaultChecked`: Radix's uncontrolled value, which a nested control starts from. */
const defaultOf = (model: string) => `default${upperFirst(model)}`

function reference(node: ComponentReference, uses: MarkupUses, depth: number): es.SyntaxNode {
  uses.components.add(node.component)
  return jsx.element(
    node.component,
    [
      jsx.attribute('className', jsx.container(moduleClass(node.className))),
      ...node.props.map((prop) =>
        jsx.attribute(prop.name, prop.value === true ? null : jsx.stringValue(prop.value))
      ),
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
  const kind = uses.kind
  const radix = RADIX[kind]
  const part = node.part ? radix?.parts[node.part] : undefined
  const root = node.part === 'root'
  const native = root && !part
  // The design's own classes, the state styles' module class, and on the root the caller's,
  // which the spread would otherwise lose to the generated one.
  const classes = [
    ...(node.attrs.class ? [es.string(node.attrs.class)] : []),
    moduleClass(node.className),
    ...(root ? [es.parseExpression('props.className')] : [])
  ]
  const only = classes.length === 1 ? classes.at(0) : undefined
  const className = only ?? es.fill(CLASS_NAMES, { $classes: es.array(classes) })
  const attributes = [
    ...(native ? [jsx.attribute('type', jsx.stringValue('button'))] : []),
    // The root passes the caller's props on, such as `checked` or `onClick`.
    ...(root ? [jsx.spread(es.identifier('props'))] : []),
    ...Object.entries(omit(node.attrs, ['class'])).map(([name, value]) =>
      jsx.attribute(name, jsx.stringValue(value))
    ),
    jsx.attribute('className', jsx.container(className)),
    ...node.bindings.flatMap((binding) => {
      if (binding.type === 'prop')
        return [jsx.attribute(binding.attribute, jsx.container(es.identifier(binding.prop.name)))]
      // Radix sets `data-disabled` on its own roots; a native button needs it for the styles.
      if (binding.type === 'disabled' && native)
        return [jsx.attribute('data-disabled', jsx.container(DISABLED_FLAG))]
      return []
    })
  ]
  // Words alone stay on the element's line, where a line break would add a space.
  const inline =
    node.children.length === 1 &&
    (node.children[0]?.type === 'text' || node.children[0]?.type === 'textProp')
  return jsx.element(
    tagOf(node, kind),
    attributes,
    node.children.map((child) => element(child, uses, depth + 1)),
    depth,
    inline
  )
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

/** The root's own props, extended with the component's variant props when it has any. */
function propsType(component: ComponentModel): es.SyntaxNode {
  const radix = RADIX[component.kind]
  const base = radix
    ? es.fill(es.parseType('ComponentProps<typeof $Root>'), {
        $Root: {
          type: 'TSQualifiedName',
          left: es.identifier(PRIMITIVE(radix.namespace)),
          right: es.identifier('Root')
        }
      })
    : es.parseType("ComponentProps<'button'>")
  if (component.props.length === 0 && component.texts.length === 0) return base
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
  const own = [...component.props, ...component.texts]
  if (own.length === 0) return es.identifier('props')
  return {
    type: 'ObjectPattern',
    properties: [
      ...own.map((prop) => ({
        type: 'Property',
        kind: 'init',
        key: es.identifier(prop.name),
        value: {
          type: 'AssignmentPattern',
          left: es.identifier(prop.name),
          right: es.string(prop.default)
        },
        computed: false,
        method: false,
        shorthand: true
      })),
      { type: 'RestElement', argument: es.identifier('props') }
    ]
  }
}

/**
 * A component as a React component on Radix UI: its parts as Radix primitives from the
 * `radix-ui` package, its variants' state styles in a CSS module, and props that extend the
 * Radix root's with its other variant properties.
 */
export const reactComponent: ComponentGenerator = async (component) => {
  const radix = RADIX[component.kind]
  const stylesPath = `${component.name}.module.css`
  const uses: MarkupUses = { kind: component.kind, components: new Set(), icons: false }
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
  const [typeImport, stylesImport, ...rest] = es.fill(MODULE, {
    $styles: es.string(`./${stylesPath}`),
    $Props: es.identifier(`${component.name}Props`),
    $Type: propsType(component),
    $Name: es.identifier(component.name),
    $params: parameters(component),
    $body: body
  }).body
  const program = {
    type: 'Program',
    sourceType: 'module',
    body: [typeImport, ...imports, stylesImport, ...rest]
  }
  const { css } = await stateStylesToCSS(component.styles)
  const model = component.model
  return {
    files: [
      { path: `${component.name}.tsx`, content: `${jsx.printModule(program)}\n` },
      { path: stylesPath, content: css }
    ],
    entry: { path: `./${component.name}`, named: true },
    // Radix's uncontrolled value, so a story's control and its play function can both change it.
    valueArg: model ? defaultOf(model) : null
  }
}
