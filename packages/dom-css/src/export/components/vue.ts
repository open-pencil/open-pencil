import { stateStylesToCSS } from '#dom-css/behaviours/states/css'
import { layerClassNames, propAttribute } from '#dom-css/behaviours/states/names'
import type { StateElement, StateNode } from '#dom-css/behaviours/states/types'
import { compact } from 'es-toolkit/array'

import { es, vue } from '@open-pencil/emit'

import type { ComponentModel, GeneratedKind } from './model'

/** The Reka UI components a kind renders, by part, and the prop its model binds. */
const REKA: Record<
  GeneratedKind,
  { parts: Record<string, string>; model?: 'modelValue' | 'open' }
> = {
  button: { parts: {} },
  switch: { parts: { root: 'SwitchRoot', thumb: 'SwitchThumb' }, model: 'modelValue' },
  checkbox: {
    parts: { root: 'CheckboxRoot', indicator: 'CheckboxIndicator' },
    model: 'modelValue'
  },
  toggle: { parts: { root: 'Toggle' }, model: 'modelValue' },
  collapsible: {
    parts: {
      root: 'CollapsibleRoot',
      trigger: 'CollapsibleTrigger',
      content: 'CollapsibleContent'
    },
    model: 'open'
  }
}

const identifier = (name: string) => es.identifier(name)

/** `disabled || undefined`, so a native button sets `data-disabled` only while disabled. */
const DISABLED_FLAG = es.parseExpression('disabled || undefined')

function rootAttributes(component: ComponentModel, native: boolean): vue.VueAttribute[] {
  const reka = REKA[component.kind]
  const model = component.model && reka.model
  return [
    ...(native ? [vue.attribute('type', 'button')] : []),
    ...(model
      ? [vue.model(identifier(component.model ?? ''), model === 'open' ? 'open' : undefined)]
      : []),
    ...(component.disabled ? [vue.bound('disabled', identifier('disabled'))] : []),
    // Reka sets `data-disabled` on its own roots; a native button needs it for the state styles.
    ...(component.disabled && native ? [vue.bound('data-disabled', DISABLED_FLAG)] : []),
    ...component.props.map((prop) => vue.bound(propAttribute(prop.property), identifier(prop.name)))
  ]
}

function templateNode(
  node: StateNode,
  component: ComponentModel,
  classes: Map<StateElement, string>,
  used: Set<string>
): vue.VueNode {
  if (node.type === 'text') return vue.text(node.text)
  const part = component.parts.get(node)
  const reka = part ? REKA[component.kind].parts[part] : undefined
  if (reka) used.add(reka)
  const native = part === 'root' && !reka
  const className = compact([node.attrs.class, classes.get(node)]).join(' ')
  const attributes = [
    ...Object.entries(node.attrs)
      .filter(([name]) => name !== 'class')
      .map(([name, value]) => vue.attribute(name, value)),
    vue.attribute('class', className),
    ...(part === 'root' ? rootAttributes(component, native) : [])
  ]
  const tag = reka ?? (native ? 'button' : node.tagName)
  return vue.element(
    tag,
    attributes,
    node.children.map((child) => templateNode(child, component, classes, used))
  )
}

function propsType(component: ComponentModel): es.SyntaxNode {
  const members: [string, es.SyntaxNode, boolean][] = component.props.map((prop) => [
    prop.name,
    es.stringUnionType(prop.options),
    true
  ])
  if (component.disabled) members.unshift(['disabled', es.parseType('boolean'), true])
  return es.objectType(members)
}

function propsDefaults(component: ComponentModel): es.SyntaxNode {
  return es.object([
    ...(component.disabled ? [['disabled', es.parseExpression('false')] as const] : []),
    ...component.props.map((prop) => [prop.name, es.string(prop.default)] as const)
  ])
}

const PROPS = es.parseModule('withDefaults(defineProps<$Props>(), $defaults)')
const MODEL = es.parseModule('const $model = defineModel<boolean>($name, { default: false })')

function script(component: ComponentModel, used: Set<string>): es.SyntaxNode {
  const imports =
    used.size > 0
      ? [
          {
            type: 'ImportDeclaration',
            importKind: 'value',
            specifiers: [...used].sort().map((name) => ({
              type: 'ImportSpecifier',
              imported: identifier(name),
              local: identifier(name)
            })),
            source: es.string('reka-ui')
          }
        ]
      : []
  const props =
    component.disabled || component.props.length > 0
      ? es.fill(PROPS, { $Props: propsType(component), $defaults: propsDefaults(component) }).body
      : []
  const model = component.model
    ? es.fill(MODEL, { $model: identifier(component.model), $name: es.string(component.model) })
        .body
    : []
  return { type: 'Program', sourceType: 'module', body: [...imports, ...props, ...model] }
}

/**
 * A component as a Vue single-file component on Reka UI: its variants' state styles in a
 * scoped stylesheet, its parts as Reka components, and its props from the behaviour and its
 * other variant properties.
 */
export async function vueComponent(component: ComponentModel): Promise<string> {
  const classes = layerClassNames(component.styles)
  const used = new Set<string>()
  const template = templateNode(component.styles.root, component, classes, used)
  const { css } = await stateStylesToCSS(component.styles)
  return vue.printComponent({ script: script(component, used), template, style: css })
}
