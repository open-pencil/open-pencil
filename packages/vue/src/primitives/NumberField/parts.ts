import { defineComponent, h } from 'vue'

import { useNumberField } from '#vue/primitives/NumberField/context'

export type NumberFieldPartName = 'leading' | 'unit' | 'trailing' | 'menu'

function createNumberFieldPart(part: NumberFieldPartName) {
  return defineComponent({
    name: `NumberField${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`,
    inheritAttrs: false,
    setup(_props, { attrs, slots }) {
      const ctx = useNumberField()
      return () =>
        h(
          'span',
          { ...attrs, ...ctx.stateAttrs.value, 'data-slot': part },
          slots.default?.(ctx.slotProps.value)
        )
    }
  })
}

export const NumberFieldLeading = createNumberFieldPart('leading')
export const NumberFieldUnit = createNumberFieldPart('unit')
export const NumberFieldTrailing = createNumberFieldPart('trailing')
export const NumberFieldMenu = createNumberFieldPart('menu')
