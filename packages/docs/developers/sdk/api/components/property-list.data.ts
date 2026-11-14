import { defineComponentMetaLoader } from '#docs/sdk/component-meta'

const sources = [
  'packages/vue/src/primitives/PropertyList/PropertyListRoot.vue',
  'packages/vue/src/primitives/PropertyList/PropertyListItem.vue',
  'packages/vue/src/primitives/PropertyList/PropertyListAdd.vue',
  'packages/vue/src/primitives/PropertyList/PropertyListRemove.vue',
  'packages/vue/src/primitives/PropertyList/PropertyListVisibility.vue'
]

export default defineComponentMetaLoader(sources)
