import type { Loader } from 'vitepress'

import {
  readComponentMeta,
  type SdkComponentMeta
} from '../../../../.vitepress/sdk/component-meta'

const sources = [
  'packages/vue/src/primitives/NumberField/NumberFieldRoot.vue',
  'packages/vue/src/primitives/NumberField/NumberFieldInput.vue',
  'packages/vue/src/primitives/NumberField/NumberFieldValue.vue'
]

export interface NumberFieldComponentData {
  components: SdkComponentMeta[]
}

export default {
  watch: sources.map((source) => `../../../../../../${source}`),
  load(): NumberFieldComponentData {
    return { components: sources.map(readComponentMeta) }
  }
} satisfies Loader
