import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

import AppCombobox from './AppCombobox.vue'
import AppSelect from './AppSelect.vue'

const meta = {
  title: 'Design System/Selection/Select',
  render: () => ({
    components: { AppSelect, AppButton },
    setup() {
      const russian = ref(false)
      const value = ref('dark')
      const options = computed(() => [
        { value: 'dark', label: russian.value ? 'Тёмная' : 'Dark' },
        { value: 'light', label: russian.value ? 'Светлая' : 'Light' }
      ])
      return { russian, value, options }
    },
    template: `
      <div class="flex w-64 flex-col gap-4">
        <AppSelect v-model="value" :options="options" label="Theme" />
        <AppButton variant="outline" @click="russian = !russian">Switch language</AppButton>
      </div>`
  })
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ReactiveLabels: Story = {}

export const Grouped: Story = {
  render: () => ({
    components: { AppSelect },
    setup() {
      const value = ref('MULTIPLY')
      const groups = [
        { options: [{ value: 'NORMAL', label: 'Normal' }] },
        {
          options: [
            { value: 'DARKEN', label: 'Darken' },
            { value: 'MULTIPLY', label: 'Multiply' }
          ]
        },
        {
          label: 'Lighten',
          options: [
            { value: 'LIGHTEN', label: 'Lighten' },
            { value: 'SCREEN', label: 'Screen' }
          ]
        }
      ]
      return { value, groups }
    },
    template: `
      <div class="w-40 p-16">
        <AppSelect v-model="value" :groups="groups" label="Blend mode" />
      </div>`
  })
}

/** Each row is one step of the control scale: the input, select, combobox, and button line up. */
export const ControlSizes: Story = {
  render: () => ({
    components: { AppSelect, AppButton, AppCombobox, AppInput },
    setup() {
      const sizes = ['xs', 'sm', 'md', 'lg'] as const
      const text = ref('Name')
      const value = ref('dark')
      const model = ref('gpt')
      const options = [
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' }
      ]
      const models = [
        { value: 'gpt', label: 'GPT' },
        { value: 'claude', label: 'Claude' }
      ]
      return { sizes, text, value, model, options, models }
    },
    template: `
      <div class="flex w-[36rem] flex-col gap-3">
        <div v-for="size in sizes" :key="size" class="flex items-center gap-2" :data-size="size">
          <AppInput v-model="text" :size="size" aria-label="Name" class="flex-1" />
          <AppSelect v-model="value" :size="size" :options="options" label="Theme" :ui="{ trigger: 'w-28' }" />
          <AppCombobox v-model="model" :size="size" :options="models" label="Model" :ui="{ trigger: 'w-28' }" />
          <AppButton :size="size" variant="outline">Save</AppButton>
        </div>
      </div>`
  })
}
