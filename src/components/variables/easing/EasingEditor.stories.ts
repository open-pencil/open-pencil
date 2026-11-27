import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import type { Easing } from '@open-pencil/scene-graph'

import EasingEditor from './EasingEditor.vue'

/** The editor as it opens beside the variables panel, applying each change it reports. */
const meta = {
  title: 'App/Editor/Easing Editor',
  args: { initial: { easing: 'EASE_IN', bezier: { x1: 0.42, y1: 0, x2: 1, y2: 1 } } },
  render: (args) => ({
    components: { EasingEditor },
    setup: () => ({ easing: ref<Easing>(args.initial) }),
    template: `
      <div class="w-fit rounded-lg border border-border bg-panel text-surface">
        <EasingEditor :easing="easing" @update="easing = $event" />
      </div>`
  })
} satisfies Meta<{ initial: Easing }>

export default meta
type Story = StoryObj<typeof meta>

export const Curve: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Flip curve' }))
    // Ease in played backwards is Ease out.
    await expect(canvas.getByLabelText('Bezier')).toHaveValue('0, 0, 0.58, 1')
  }
}

export const BackCurve: Story = {
  args: { initial: { easing: 'OUT_BACK_CUBIC', bezier: { x1: 0.45, y1: 1.45, x2: 0.8, y2: 1 } } }
}

export const Hold: Story = { args: { initial: { easing: 'HOLD' } } }

export const SpringByBounce: Story = {
  args: {
    initial: { easing: 'CUSTOM_SPRING', spring: { stiffness: 100, damping: 12, mass: 1 } }
  }
}

export const SpringByPhysics: Story = {
  args: {
    initial: {
      easing: 'CUSTOM_SPRING',
      spring: { stiffness: 100, damping: 12, mass: 1, type: 'PHYSICAL', platform: 'IOS_WEB' }
    }
  }
}
