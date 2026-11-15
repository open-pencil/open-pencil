import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import AppCopyButton from './AppCopyButton.vue'

type AppCopyButtonStoryArgs = {
  value: string | (() => Promise<string>)
  label: string
  copiedLabel: string
  icon: boolean
  variant: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
  onCopied: () => void
  onFailed: (error: unknown) => void
}

type Story = StoryObj<AppCopyButtonStoryArgs>

const meta = {
  title: 'Design System/Actions/Copy Button',
  component: AppCopyButton,
  args: {
    value: 'npx @open-pencil/mcp',
    label: 'Copy command',
    copiedLabel: 'Copied',
    icon: false,
    variant: 'outline',
    onCopied: fn(),
    onFailed: fn()
  },
  render: (args) => ({
    components: { AppCopyButton },
    setup: () => ({ args }),
    template: '<div class="flex items-center gap-3 p-6"><AppCopyButton v-bind="args" /></div>'
  })
} satisfies Meta<AppCopyButtonStoryArgs>

export default meta

/** It says it copied in place, then goes back to its label. */
export const Labelled: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Copy command' }))
    await expect(await canvas.findByRole('button', { name: 'Copied' })).toBeVisible()
    await expect(args.onCopied).toHaveBeenCalledOnce()
  }
}

export const Icon: Story = { args: { icon: true, label: 'Copy response' } }

/** Text built when clicked, such as an export, is read then. */
export const BuiltWhenClicked: Story = {
  args: { value: async () => 'A report read when copied', label: 'Copy report' }
}

/**
 * A failure to build the text is the owner's to report, and the button does not say it copied,
 * even right after an earlier copy that did.
 */
export const Failed: Story = {
  args: { label: 'Copy report' },
  render: (args) => ({
    components: { AppCopyButton },
    setup: () => {
      // The report can be read until it has been copied once; after that, reading it fails.
      let read = false
      const value = () =>
        read ? Promise.reject(new Error('Export failed')) : Promise.resolve('A report')
      const copied = () => {
        read = true
        args.onCopied()
      }
      return { args, value, copied }
    },
    template:
      '<div class="flex items-center gap-3 p-6"><AppCopyButton v-bind="args" :value="value" @copied="copied" /></div>'
  }),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Copy report' }))
    await userEvent.click(await canvas.findByRole('button', { name: 'Copied' }))
    await waitFor(() => expect(args.onFailed).toHaveBeenCalledOnce())
    await expect(canvas.getByRole('button', { name: 'Copy report' })).toBeVisible()
  }
}
