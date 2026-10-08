import { computed } from 'vue'

import { useComponentPropertyAuthoring, usePanelMessages } from '@open-pencil/vue'

export type BindableField = 'TEXT' | 'VISIBLE' | 'INSTANCE_SWAP'

const FIELD_TYPES = { TEXT: 'TEXT', VISIBLE: 'BOOLEAN', INSTANCE_SWAP: 'INSTANCE_SWAP' } as const

/** How the selected component layer's field links to a property of its component. */
export function usePropertyBinding(field: BindableField) {
  const authoring = useComponentPropertyAuthoring()
  const panels = usePanelMessages()
  const context = authoring.context
  const propertyId = computed(
    () =>
      context.value?.node.componentPropertyReferences.find((item) => item.field === field)
        ?.propertyId
  )
  const fieldLabels = computed(() => ({
    TEXT: panels.value.textContent,
    VISIBLE: panels.value.layerVisibility,
    INSTANCE_SWAP: panels.value.nestedInstance
  }))

  /** A name no property of the component uses yet, from the layer's own name. */
  function suggestedName() {
    const node = context.value?.node
    const base =
      field === 'VISIBLE' ? panels.value.showLayer({ name: node?.name ?? '' }) : node?.name
    const taken = new Set(authoring.definitions.value.map((item) => item.name))
    let name = base?.trim() || fieldLabels.value[field]
    for (let suffix = 2; taken.has(name); suffix++) name = `${base} ${suffix}`
    return name
  }

  return {
    available: computed(() => !!context.value?.fields.includes(field)),
    editable: authoring.editable,
    definition: computed(() =>
      authoring.definitions.value.find((item) => item.id === propertyId.value)
    ),
    compatible: computed(() =>
      authoring.definitions.value.filter((item) => item.type === FIELD_TYPES[field])
    ),
    fieldLabel: computed(() => fieldLabels.value[field]),
    create: () => {
      const node = context.value?.node
      if (node) authoring.expose(node.id, field, suggestedName())
    },
    bind: (id: string | null) => {
      const node = context.value?.node
      if (node) authoring.bind(node.id, field, id)
    },
    goToProperty: authoring.selectOwner
  }
}
