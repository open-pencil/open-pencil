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
} satisfies Meta<typeof DesignSystem>

export default meta
type Story = StoryObj<typeof meta>

export const DesignSystemTokens: Story = {}
