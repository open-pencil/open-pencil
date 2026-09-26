import type { Meta, StoryObj } from '@storybook/vue3-vite'

import ModeEdit from './examples/ModeEdit.vue'

// Kept apart from BindableValue.stories.ts: this example builds a real editor, and the
// docs pages render the lighter state matrix, so the engine must not share its module.
const meta = {
  title: 'Vue SDK/Primitives/BindableValue'
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const ModeEditing: Story = {
  render: () => ({ components: { ModeEdit }, template: '<ModeEdit />' })
}
