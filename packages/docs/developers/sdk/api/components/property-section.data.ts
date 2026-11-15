import { defineComponentMetaLoader } from '#docs/sdk/component-meta'

const sources = [
  'packages/vue/src/primitives/PropertySection/PropertySectionRoot.vue',
  'packages/vue/src/primitives/PropertySection/PropertySectionHeader.vue',
  'packages/vue/src/primitives/PropertySection/PropertySectionTitle.vue',
  'packages/vue/src/primitives/PropertySection/PropertySectionActions.vue',
  'packages/vue/src/primitives/PropertySection/PropertySectionContent.vue',
  'packages/vue/src/primitives/PropertySection/PropertySectionEmptyAction.vue'
]

export default defineComponentMetaLoader(sources)
