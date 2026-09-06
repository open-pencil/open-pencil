import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import AppCombobox from './AppCombobox.vue'

const models = [
  {
    value: 'anthropic/claude-sonnet-5',
    label: 'Claude Sonnet 5',
    meta: 'Recommended',
    group: 'Recommended'
  },
  {
    value: 'openai/gpt-5.6',
    label: 'GPT-5.6',
    meta: 'Latest',
    group: 'Latest'
  },
  {
    value: 'google/gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    meta: 'Latest',
    group: 'Latest'
  },
  {
    value: 'deepseek/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    group: 'All models'
  },
  {
    value: 'z-ai/glm-5.3-flash',
    label: 'GLM-5.3 Flash',
    group: 'All models'
  }
]

type AppComboboxStoryArgs = {
  options: Array<{
    value: string
    label: string
    meta?: string
    group?: string
  }>
  label: string
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  disabled: boolean
  resultLimit: number
}

type Story = StoryObj<AppComboboxStoryArgs>

const meta = {
  title: 'Design System/Combobox',
  component: AppCombobox,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { AppCombobox },
    setup() {
      const value = ref('anthropic/claude-sonnet-5')
      return { args, value }
    },
    template: `
      <div class="w-80 bg-app p-6 text-surface">
        <AppCombobox v-model="value" v-bind="args" />
        <p class="mt-3 font-mono text-[10px] text-muted">{{ value }}</p>
      </div>
    `
  }),
  args: {
    options: models,
    label: 'Model',
    placeholder: 'Select a model',
    searchPlaceholder: 'Search models…',
    emptyLabel: 'No matching models',
    resultLimit: 100
  }
} satisfies Meta<AppComboboxStoryArgs>

export default meta

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Model' }))
    const body = within(document.body)
    const search = body.getByRole('combobox', { name: 'Search models…' })
    await userEvent.type(search, 'gemni')
    await expect(body.getByRole('option', { name: /Gemini 3\.8 Flash/ })).toBeVisible()
    await expect(body.queryByRole('option', { name: /Claude Sonnet 5/ })).not.toBeInTheDocument()
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(canvas.getByText('google/gemini-3.8-flash')).toBeVisible()
  }
}
export const Disabled: Story = { args: { disabled: true } }
export const Empty: Story = { args: { options: [] } }
export const LongLabels: Story = {
  args: {
    options: [
      ...models,
      {
        value: 'provider/an-unusually-long-model-identifier-for-testing-overflow',
        label: 'An unusually long model name for testing overflow behavior',
        group: 'All models'
      }
    ]
  }
}
