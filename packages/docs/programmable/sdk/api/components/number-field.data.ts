import { defineComponentMetaLoader } from '#docs/sdk/component-meta'

const sources = [
  'packages/vue/src/primitives/NumberField/NumberFieldRoot.vue',
  'packages/vue/src/primitives/NumberField/NumberFieldInput.vue',
  'packages/vue/src/primitives/NumberField/NumberFieldValue.vue'
]

export default defineComponentMetaLoader(sources)
