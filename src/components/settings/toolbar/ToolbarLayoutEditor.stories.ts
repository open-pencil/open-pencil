import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import {
  DEFAULT_TOOLBAR_LAYOUT,
  normalizeToolbarLayout,
  type ToolbarLayout
} from '@/app/editor/toolbar/layout'

import ToolbarLayoutEditor from './ToolbarLayoutEditor.vue'

type Args = { layout: ToolbarLayout }

const meta = {
  title: 'App/Settings/Toolbar Layout',
  args: { layout: structuredClone(DEFAULT_TOOLBAR_LAYOUT) },
  render: (args) => ({
    components: { ToolbarLayoutEditor },
    // Args arrive as reactive proxies, so the editor gets its own copy to change.
    setup: () => ({ layout: ref(normalizeToolbarLayout(args.layout.groups, args.layout.hidden)) }),
    template: '<div class="max-w-xl bg-panel p-4"><ToolbarLayoutEditor v-model="layout" /></div>'
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Customized: Story = {
  args: {
    layout: normalizeToolbarLayout(
      [['SELECT', 'HAND'], ['FRAME'], ['SECTION'], ['TEXT', 'COMMENT'], ['insert-icon']],
      ['PEN', 'STAR']
    )
  }
}

export const Regrouping: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('switch', { name: 'Show Pen' }))
    await expect(canvas.getByRole('switch', { name: 'Show Pen' })).not.toBeChecked()

    // Grouping moves the row into the box above, so each check finds it again.
    const options = () => canvas.getByRole('button', { name: 'Comment options' })
    const menu = within(canvasElement.ownerDocument.body)
    await userEvent.click(options())
    await userEvent.click(await menu.findByRole('menuitem', { name: 'Group with Hand' }))
    await expect(options()).toHaveFocus()
    await userEvent.click(options())
    await expect(await menu.findByRole('menuitem', { name: 'Ungroup' })).toBeVisible()
    await userEvent.keyboard('{Escape}')

    const grip = () => canvas.getByRole('button', { name: 'Reorder Comment' })
    grip().focus()
    await userEvent.keyboard('{ArrowUp}')
    await expect(grip()).toHaveFocus()
    await expect(canvas.getByRole('switch', { name: 'Show Move' })).toBeDisabled()
  }
}
