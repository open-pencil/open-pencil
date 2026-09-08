import { expect, userEvent, within } from 'storybook/test'
import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import AppSelect from './AppSelect.vue'

const options = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'pl', label: 'Polski' },
  { value: 'ru', label: 'Русский' },
  { value: 'zh-CN', label: '简体中文' }
]

const meta = {
  title: 'UI/AppSelect',
  render: () => ({
    components: { AppSelect },
    setup() {
      const value = ref('en')
      return { options, value }
    },
    template:
      '<div class="w-28"><AppSelect v-model="value" label="Language" :options="options" /></div>'
  })
} satisfies Meta

export default meta
type Story = StoryObj

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    const root = canvasElement.ownerDocument.documentElement
    const pageBody = canvasElement.ownerDocument.body
    const before = {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      overflow: getComputedStyle(pageBody).overflow,
      paddingRight: getComputedStyle(pageBody).paddingRight
    }

    await userEvent.click(canvas.getByRole('button', { name: 'Language' }))
    const options = body.getAllByRole('option')
    await expect(options).toHaveLength(9)
    await expect(body.getByRole('option', { name: 'English' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect({
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      scrollHeight: root.scrollHeight,
      overflow: getComputedStyle(pageBody).overflow,
      paddingRight: getComputedStyle(pageBody).paddingRight
    }).toEqual(before)
    await userEvent.keyboard('{ArrowDown}{Enter}')
    await expect(canvas.getByRole('button', { name: 'Language' })).toHaveTextContent('Deutsch')
  }
}

export const LongLabels: Story = {
  render: () => ({
    components: { AppSelect },
    setup() {
      const value = ref('system')
      const longOptions = [
        { value: 'system', label: 'Use system language' },
        { value: 'browser', label: 'Use browser preference' }
      ]
      return { longOptions, value }
    },
    template:
      '<div class="w-36"><AppSelect v-model="value" label="Language" :options="longOptions" /></div>'
  })
}
