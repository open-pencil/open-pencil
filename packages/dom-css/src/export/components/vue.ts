import { stateStylesToCSS } from '#dom-css/behaviours/states/css'
import { compact } from 'es-toolkit/array'
import { omit } from 'es-toolkit/object'

import { es, vue } from '@open-pencil/emit'

import type {
  ComponentBinding,
  ComponentGenerator,
  ComponentModel,
  ComponentNode,
  GeneratedKind
} from './model'

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

function bindingAttributes(
  binding: ComponentBinding,
  kind: GeneratedKind,
  native: boolean
): vue.VueAttribute[] {
  if (binding.type === 'model')
    return [vue.model(identifier(binding.name), REKA[kind].model === 'open' ? 'open' : undefined)]
  if (binding.type === 'prop') return [vue.bound(binding.attribute, identifier(binding.prop.name))]
  // Reka sets `data-disabled` on its own roots; a native button needs it for the state styles.
  return [
    vue.bound('disabled', identifier('disabled')),
    ...(native ? [vue.bound('data-disabled', DISABLED_FLAG)] : [])
  ]
}

function templateNode(node: ComponentNode, kind: GeneratedKind, used: Set<string>): vue.VueNode {
  if (node.type === 'text') return vue.text(node.value)
  const reka = node.part ? REKA[kind].parts[node.part] : undefined
  if (reka) used.add(reka)
  const native = node.part === 'root' && !reka
  return vue.element(
    reka ?? (native ? 'button' : node.tag),
    [
      ...(native ? [vue.attribute('type', 'button')] : []),
      ...Object.entries(omit(node.attrs, ['class'])).map(([name, value]) =>
        vue.attribute(name, value)
      ),
      vue.attribute('class', compact([node.attrs.class, node.className]).join(' ')),
      ...node.bindings.flatMap((binding) => bindingAttributes(binding, kind, native))
    ],
    node.children.map((child) => templateNode(child, kind, used))
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
export const vueComponent: ComponentGenerator = async (component) => {
  const used = new Set<string>()
  const template = templateNode(component.tree, component.kind, used)
  const { css } = await stateStylesToCSS(component.styles)
  const path = `${component.name}.vue`
  return {
    files: [
      {
        path,
        content: vue.printComponent({ script: script(component, used), template, style: css })
      }
    ],
    entry: { path: `./${path}`, named: false },
    // `v-model` binds the value, and its prop takes a story's initial value.
    valueArg: component.model
  }
}
