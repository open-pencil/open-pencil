import { defineComponentMetaLoader } from '#docs/sdk/component-meta'

const sources = [
  'packages/vue/src/primitives/BindableValue/BindableValueRoot.vue',
  'packages/vue/src/primitives/BindableValue/BindableValueTrigger.vue',
  'packages/vue/src/primitives/BindableValue/BindableValuePicker.vue'
]

export default defineComponentMetaLoader(sources)
