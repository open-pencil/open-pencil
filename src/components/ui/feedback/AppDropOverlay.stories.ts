import type { Meta, StoryObj } from '@storybook/vue3-vite'

import AppDropOverlay from './AppDropOverlay.vue'
import type { DropOverlayProps } from './drop-overlay'

const meta = {
  title: 'Design System/Drop Overlay',
  component: AppDropOverlay,
  parameters: { layout: 'centered' }
} satisfies Meta<DropOverlayProps>

export default meta
type Story = StoryObj<DropOverlayProps>

/** A field, such as the chat composer, with images dragged over it. */
function fieldStory(accepts: boolean, label: string): Story {
  return {
    args: { visible: true, shape: 'field', accepts, label },
    render: (args) => ({
      components: { AppDropOverlay },
      setup: () => ({ args }),
      template: `
        <div class="relative w-72 rounded-xl border border-border bg-input p-3 text-xs text-muted">
          Describe a change…
          <div class="mt-6 h-6" />
          <AppDropOverlay v-bind="args" />
        </div>
      `
    })
  }
}

export const FieldAccepts = fieldStory(true, 'Drop images to attach')
export const FieldRefuses = fieldStory(false, 'Up to 4 images per message')

export const Surface: Story = {
  args: { visible: true },
  render: (args) => ({
    components: { AppDropOverlay },
    setup: () => ({ args }),
    template: `<div class="relative h-48 w-80 bg-canvas"><AppDropOverlay v-bind="args" /></div>`
  })
}
