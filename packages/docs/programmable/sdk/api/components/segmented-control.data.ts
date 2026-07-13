import { defineComponentMetaLoader } from '#docs/sdk/component-meta'

const sources = [
  'packages/vue/src/primitives/SegmentedControl/SegmentedControlRoot.vue',
  'packages/vue/src/primitives/SegmentedControl/SegmentedControlItem.vue'
]

export default defineComponentMetaLoader(sources)
