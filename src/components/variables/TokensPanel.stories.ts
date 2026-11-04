import type { Meta, StoryObj } from '@storybook/vue3-vite'

import DesignSystem from './examples/DesignSystem.vue'

const meta = {
  title: 'App/Editor/Tokens Panel',
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
} satisfies Meta<{ width?: number; library?: boolean }>

export default meta
type Story = StoryObj<{ width?: number; library?: boolean }>

/** From 56rem the CSS name has its own column and the inspector sits beside the list. */
export const DesignSystemTokens: Story = {}

/**
 * A collection copied from a library carries a Library badge and stays editable. Surface/Ink was
 * added in the file, which Figma does not show in a library's collection, and its row says so.
 */
export const FromLibrary: Story = { args: { library: true } }

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
