import { stateStylesToCSS } from '#dom-css/behaviours/states/css'
import { compact } from 'es-toolkit/array'
import { omit } from 'es-toolkit/object'
import { camelCase, upperFirst } from 'es-toolkit/string'

import { es, vue } from '@open-pencil/emit'

import { claimName } from '../storybook/names'
import type {
  ComponentBinding,
  ComponentGenerator,
  ComponentModel,
  ComponentNode,
  GeneratedKind
} from './model'
import type { ComponentReference } from './references'

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

/** What a template uses, which its script imports and declares. */
interface TemplateUses {
  kind: GeneratedKind
  /** Reka components. */
  reka: Set<string>
  /** Other generated components. */
  components: Set<string>
  icons: boolean
  /** A ref per nested control drawn on, which its `v-model` binds. */
  models: { name: string }[]
  taken: Set<string>
}

/** The Iconify component, named apart from any component the design calls `Icon`. */
const ICONIFY = 'IconifyIcon'
const TRUE = es.parseExpression('true')

function reference(node: ComponentReference, uses: TemplateUses): vue.VueNode {
  uses.components.add(node.component)
  const model = node.model
    ? claimName(`${camelCase(node.component)}${upperFirst(node.model)}`, uses.taken)
    : null
  if (model) uses.models.push({ name: model })
  return vue.element(node.component, [
    vue.attribute('class', node.className),
    ...node.props.map((prop) =>
      prop.value === true ? vue.bound(prop.name, TRUE) : vue.attribute(prop.name, prop.value)
    ),
    // The control stays operable, starting from the value the design draws.
    ...(model && node.model ? [vue.model(identifier(model), node.model)] : [])
  ])
}

function templateNode(node: ComponentNode, uses: TemplateUses): vue.VueNode {
  if (node.type === 'text') return vue.text(node.value)
  if (node.type === 'textProp') return vue.interpolation(identifier(node.name))
  if (node.type === 'reference') return reference(node, uses)
  if (node.type === 'icon') {
    uses.icons = true
    return vue.element(ICONIFY, [
      vue.attribute('icon', node.icon),
      vue.attribute('class', node.className)
    ])
  }
  const reka = node.part ? REKA[uses.kind].parts[node.part] : undefined
  if (reka) uses.reka.add(reka)
  const native = node.part === 'root' && !reka
  return vue.element(
    reka ?? (native ? 'button' : node.tag),
    [
      ...(native ? [vue.attribute('type', 'button')] : []),
      ...Object.entries(omit(node.attrs, ['class'])).map(([name, value]) =>
        vue.attribute(name, value)
      ),
      vue.attribute('class', compact([node.attrs.class, node.className]).join(' ')),
      ...node.bindings.flatMap((binding) => bindingAttributes(binding, uses.kind, native))
    ],
    node.children.map((child) => templateNode(child, uses))
  )
}

function propsType(component: ComponentModel): es.SyntaxNode {
  const members: [string, es.SyntaxNode, boolean][] = component.props.map((prop) => [
    prop.name,
    es.stringUnionType(prop.options),
    true
  ])
  if (component.disabled) members.unshift(['disabled', es.parseType('boolean'), true])
  for (const text of component.texts) members.push([text.name, es.parseType('string'), true])
  return es.objectType(members)
}

function propsDefaults(component: ComponentModel): es.SyntaxNode {
  return es.object([
    ...(component.disabled ? [['disabled', es.parseExpression('false')] as const] : []),
    ...component.props.map((prop) => [prop.name, es.string(prop.default)] as const),
    ...component.texts.map((text) => [text.name, es.string(text.default)] as const)
  ])
}

const PROPS = es.parseModule('withDefaults(defineProps<$Props>(), $defaults)')
const MODEL = es.parseModule('const $model = defineModel<boolean>($name, { default: false })')

function namedImport(names: readonly string[], source: string, local = (name: string) => name) {
  return {
    type: 'ImportDeclaration',
    importKind: 'value',
    specifiers: names.map((name) => ({
      type: 'ImportSpecifier',
      imported: identifier(name),
      local: identifier(local(name))
    })),
    source: es.string(source)
  }
}

const IMPORT_COMPONENT = es.parseModule(`import $Component from '$path'`)
const MODEL_REF = es.parseModule('const $name = ref(true)')

function script(component: ComponentModel, uses: TemplateUses): es.SyntaxNode {
  const imports = [
    ...(uses.models.length > 0 ? [namedImport(['ref'], 'vue')] : []),
    ...(uses.icons ? [namedImport(['Icon'], '@iconify/vue', () => ICONIFY)] : []),
    ...(uses.reka.size > 0 ? [namedImport([...uses.reka].sort(), 'reka-ui')] : []),
    ...[...uses.components].sort().flatMap(
      (name) =>
        es.fill(IMPORT_COMPONENT, {
          $Component: identifier(name),
          $path: es.string(`./${name}.vue`)
        }).body
    )
  ]
  const props =
    component.disabled || component.props.length > 0 || component.texts.length > 0
      ? es.fill(PROPS, { $Props: propsType(component), $defaults: propsDefaults(component) }).body
      : []
  const model = component.model
    ? es.fill(MODEL, { $model: identifier(component.model), $name: es.string(component.model) })
        .body
    : []
  const refs = uses.models.flatMap(
    (item) => es.fill(MODEL_REF, { $name: identifier(item.name) }).body
  )
  return {
    type: 'Program',
    sourceType: 'module',
    body: [...imports, ...props, ...model, ...refs]
  }
}

/**
 * A component as a Vue single-file component on Reka UI: its variants' state styles in a
 * scoped stylesheet, its parts as Reka components, and its props from the behaviour and its
 * other variant properties.
 */
export const vueComponent: ComponentGenerator = async (component) => {
  const uses: TemplateUses = {
    kind: component.kind,
    reka: new Set(),
    components: new Set(),
    icons: false,
    models: [],
    // Refs share the script with the component's own props and model.
    taken: new Set([
      ...component.props.map((prop) => prop.name),
      ...component.texts.map((text) => text.name),
      ...(component.model ? [component.model] : []),
      'disabled'
    ])
  }
  const template = templateNode(component.tree, uses)
  const { css } = await stateStylesToCSS(component.styles)
  const path = `${component.name}.vue`
  return {
    files: [
      {
        path,
        content: vue.printComponent({ script: script(component, uses), template, style: css })
      }
    ],
    entry: { path: `./${path}`, named: false },
    // `v-model` binds the value, and its prop takes a story's initial value.
    valueArg: component.model
  }
}
