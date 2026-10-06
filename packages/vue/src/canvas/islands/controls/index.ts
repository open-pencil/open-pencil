import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
  CheckboxRoot,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  ProgressIndicator,
  ProgressRoot,
  RadioGroupItem,
  RadioGroupRoot,
  SliderRange,
  SliderRoot,
  SliderThumb,
  SliderTrack,
  SwitchRoot,
  SwitchThumb,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger,
  Toggle,
  ToggleGroupItem,
  ToggleGroupRoot
} from 'reka-ui'
import { h, type Component, type VNode } from 'vue'

import type { DesignElement } from '@open-pencil/dom-css/export'
import { numberSettings } from '@open-pencil/scene-graph'

import type { ElementOverride, IslandRenderContext } from '#vue/canvas/islands/render'
import type { IslandRole } from '#vue/canvas/islands/roles'
import { groupOf } from '#vue/canvas/islands/roles'

import { fieldRole, fieldRoot } from './fields'
import { chooseItem, disabled, interaction, stateOf, type RoleContext } from './shared'

/** Wrap an element in a Reka part that renders through it. */
function asChild(component: Component, props: Record<string, unknown>, child: () => VNode): VNode {
  return h(component, { asChild: true, ...props }, { default: () => child() })
}

const ON_OFF: Record<string, Component> = { switch: SwitchRoot, toggle: Toggle }

function root({ island, role, base }: RoleContext<Extract<IslandRole, { type: 'root' }>>): VNode {
  const { control } = role
  const state = stateOf(island, control)
  const off = disabled(island, control)
  const pointer = interaction(state)
  const bound = (valueId: string) => ({
    modelValue: state.booleans[valueId] ?? false,
    'onUpdate:modelValue': (value: boolean) => (state.booleans[valueId] = value),
    disabled: off
  })
  const button = (props: Record<string, unknown> = {}) =>
    base({ tag: 'button', props: { type: 'button', ...pointer, ...props } })
  switch (control.kind) {
    case 'button':
      return button({ disabled: off })
    case 'switch':
    case 'toggle':
      return asChild(ON_OFF[control.kind], bound('value'), button)
    case 'checkbox':
      return asChild(CheckboxRoot, bound('value'), button)
    case 'radio':
      return button({
        role: 'radio',
        'aria-checked': state.booleans.value ?? false,
        disabled: off,
        onClick: () => (state.booleans.value = true)
      })
    case 'radioGroup':
    case 'toggleGroup':
    case 'accordion':
      return groupRoot(island, role.control, base)
    case 'slider':
    case 'progress':
    case 'tabs':
    case 'collapsible':
      return valueRoot(island, control, base)
    case 'textField':
    case 'textarea':
    case 'numberField':
      return fieldRoot(island, control, base)
  }
  return base()
}

/** A control that holds a number, a choice, or an open state rather than on and off. */
function valueRoot(
  island: IslandRenderContext,
  control: RoleContext['role']['control'],
  base: RoleContext['base']
): VNode {
  const state = stateOf(island, control)
  const off = disabled(island, control)
  const settings = numberSettings(control.behaviour, 'value')
  if (control.kind === 'slider')
    return asChild(
      SliderRoot,
      {
        modelValue: [state.number],
        'onUpdate:modelValue': (value: number[] | undefined) =>
          (state.number = value?.[0] ?? state.number),
        min: settings?.min,
        max: settings?.max,
        step: settings?.step,
        disabled: off
      },
      () => base({ props: interaction(state) })
    )
  if (control.kind === 'progress')
    return asChild(ProgressRoot, { modelValue: state.number, max: settings?.max }, () => base())
  if (control.kind === 'tabs')
    return asChild(
      TabsRoot,
      {
        modelValue: state.choice,
        'onUpdate:modelValue': (value: string | number) => (state.choice = String(value))
      },
      () => base()
    )
  return asChild(
    CollapsibleRoot,
    {
      open: state.booleans.open ?? false,
      'onUpdate:open': (value: boolean) => (state.booleans.open = value),
      disabled: off
    },
    () => base({ props: interaction(state) })
  )
}

function groupRoot(
  island: IslandRenderContext,
  group: RoleContext['role']['control'],
  base: RoleContext['base']
): VNode {
  const state = stateOf(island, group)
  const choose = (value: unknown) =>
    chooseItem(
      island,
      group,
      typeof value === 'string' || typeof value === 'number' ? String(value) : ''
    )
  if (group.kind === 'radioGroup')
    return asChild(
      RadioGroupRoot,
      {
        modelValue: state.choice,
        'onUpdate:modelValue': choose,
        disabled: disabled(island, group)
      },
      () => base()
    )
  if (group.kind === 'toggleGroup')
    return asChild(
      ToggleGroupRoot,
      { type: 'single', modelValue: state.choice, 'onUpdate:modelValue': choose },
      () => base()
    )
  return asChild(
    AccordionRoot,
    { type: 'single', collapsible: true, modelValue: state.choice, 'onUpdate:modelValue': choose },
    () => base()
  )
}

/** An item of a group: a radio, a toggle, or a collapsible inside an accordion. */
function item({ island, role, base }: RoleContext<Extract<IslandRole, { type: 'item' }>>): VNode {
  const state = stateOf(island, role.control)
  const value = String(role.index)
  const pointer = interaction(state)
  const button = () => base({ tag: 'button', props: { type: 'button', ...pointer } })
  if (role.group.kind === 'radioGroup') return asChild(RadioGroupItem, { value }, button)
  if (role.group.kind === 'toggleGroup') return asChild(ToggleGroupItem, { value }, button)
  return asChild(AccordionItem, { value }, () => base({ props: pointer }))
}

/** Parts the slider and progress components position themselves. */
const SLIDER_PARTS: Record<string, { component: Component; omit: readonly string[] }> = {
  track: { component: SliderTrack, omit: [] },
  range: { component: SliderRange, omit: ['left', 'width'] },
  thumb: { component: SliderThumb, omit: ['left', 'transform'] }
}

function part({ island, role, base }: RoleContext<Extract<IslandRole, { type: 'part' }>>): VNode {
  const { control } = role
  const sliderPart = control.kind === 'slider' ? SLIDER_PARTS[role.part] : undefined
  if (sliderPart) return asChild(sliderPart.component, {}, () => base({ omit: sliderPart.omit }))
  if (control.kind === 'switch' && role.part === 'thumb')
    return asChild(SwitchThumb, {}, () => base())
  if (control.kind === 'progress' && role.part === 'indicator') {
    const settings = numberSettings(control.behaviour, 'value')
    const span = settings ? settings.max - settings.min : 0
    const ratio = settings && span > 0 ? (stateOf(island, control).number - settings.min) / span : 0
    return asChild(ProgressIndicator, {}, () =>
      base({ style: { width: `${Math.min(1, Math.max(0, ratio)) * 100}%` } })
    )
  }
  if (control.kind === 'tabs' && role.part === 'list') return asChild(TabsList, {}, () => base())
  if (control.kind === 'collapsible') return disclosurePart(island, role, base)
  return fieldRole(island, role, base) ?? base()
}

/** A collapsible's trigger and content, or an accordion item's when it is one. */
function disclosurePart(
  island: IslandRenderContext,
  role: Extract<IslandRole, { type: 'part' }>,
  base: RoleContext['base']
): VNode {
  const inAccordion = groupOf(island.roles, role.control)?.kind === 'accordion'
  if (role.part === 'trigger') {
    const trigger = () => base({ tag: 'button', props: { type: 'button' } })
    return inAccordion
      ? asChild(AccordionHeader, {}, () => asChild(AccordionTrigger, {}, trigger))
      : asChild(CollapsibleTrigger, {}, trigger)
  }
  if (role.part === 'content')
    return asChild(inAccordion ? AccordionContent : CollapsibleContent, {}, () => base())
  return base()
}

/** Render a layer with the role it has for the controls of its island. */
export function wrapRole(
  island: IslandRenderContext,
  role: IslandRole,
  element: DesignElement,
  base: (override?: ElementOverride) => VNode
): VNode {
  switch (role.type) {
    case 'root':
      return root({ island, role, element, base })
    case 'item':
      return item({ island, role, element, base })
    case 'part':
      return part({ island, role, element, base })
    case 'trigger':
      return asChild(TabsTrigger, { value: String(role.index) }, () =>
        base({ tag: 'button', props: { type: 'button' } })
      )
    case 'panel':
      return asChild(TabsContent, { value: String(role.index) }, () => base())
    case 'text':
      return fieldRole(island, role, base) ?? base()
  }
  return base()
}
