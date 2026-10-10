import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { computed, ref } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'

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
