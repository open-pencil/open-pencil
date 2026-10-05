import type { Meta, StoryObj } from '@storybook/vue3-vite'

import DesignSystem from './examples/DesignSystem.vue'

const meta = {
  title: 'Editor/Tokens Panel',
  component: DesignSystem,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Variables as design tokens: CSS names, units, per-mode values and expressions, mode conditions, and the stylesheet they produce.'
      }
    }
  }
} satisfies Meta<{ width?: number }>

export default meta
type Story = StoryObj<{ width?: number }>

/** From 56rem the CSS name has its own column and the inspector sits beside the list. */
export const DesignSystemTokens: Story = {}

/** In a dialog-sized panel the CSS name moves under the token name; every mode still shows. */
export const Medium: Story = { args: { width: 800 } }

/**
 * Below 40rem the list shows one mode and each detail opens behind Back. This follows the panel's
 * width, so a narrow split view on a desktop window gets it too.
 */
export const Compact: Story = { args: { width: 380 } }

/** On a phone the panel fills the screen and uses the compact layout. */
export const Mobile: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  parameters: { layout: 'fullscreen' }
}
