import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'
import IconSearch from '~icons/lucide/search'
import IconX from '~icons/lucide/x'

import AppButton from '../button/AppButton.vue'
import IconButton from '../button/IconButton.vue'
import AppInput from './AppInput.vue'

const meta = {
  title: 'Design System/Inputs/Input',
  render: () => ({
    components: { AppInput, AppButton, IconButton, IconSearch, IconX },
    setup: () => {
      const search = ref<{ focus: () => void; select: () => void } | null>(null)
      function clear() {
        query.value = ''
        search.value?.focus()
      }
      const query = ref('')
      return {
        query,
        text: ref('Editable text'),
        search,
        clear,
        focusSearch: () => search.value?.focus(),
        selectSearch: () => search.value?.select()
      }
    },
    template: `<div class="flex max-w-sm flex-col gap-4 bg-panel p-6">
      <AppInput v-model="text" aria-label="Plain input" />
      <AppInput ref="search" v-model="query" type="search" name="search" aria-label="Search files" placeholder="Search files…" density="comfortable">
        <template #leading><IconSearch class="size-4" /></template>
        <template v-if="query" #trailing><IconButton label="Clear search" @click="clear"><IconX class="size-4" /></IconButton></template>
      </AppInput>
      <AppButton @click="focusSearch">Focus search</AppButton>
      <AppButton @click="selectSearch">Select search text</AppButton>
      <AppInput v-model="text" aria-label="Disabled input" disabled><template #leading><IconSearch class="size-4" /></template></AppInput>
    </div>`
  })
} satisfies Meta
export default meta
export const ConditionalTrailing: StoryObj<typeof meta> = {
  render: () => ({
    components: { AppInput, IconButton, IconX },
    setup: () => ({ value: ref('') }),
    template: `<AppInput v-model="value" aria-label="Conditional trailing input">
      <template v-if="value" #trailing><IconButton label="Clear" @click="value = ''"><IconX class="size-4" /></IconButton></template>
    </AppInput>`
  })
}

export const Default: StoryObj<typeof meta> = {}
