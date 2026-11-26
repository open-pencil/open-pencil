import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { PermissionQuestion as Question } from '@/app/shell/permission/questions'

import PermissionQuestion from './PermissionQuestion.vue'

/** An ordinary tool the agent asks to run, shown with its input. */
const tool: Question = {
  id: 1,
  kind: 'tool',
  agent: 'Claude Code',
  params: {
    toolCall: {
      title: 'Bash',
      rawInput: { command: 'ls ~/Designs', description: 'List the designs folder' }
    },
    options: [
      { optionId: 'once', name: 'Allow once', kind: 'allow_once' },
      { optionId: 'always', name: 'Always allow', kind: 'allow_always' },
      { optionId: 'reject', name: 'Reject', kind: 'reject_once' }
    ]
  }
}

/** Claude Code leaving Plan mode: the plan it asks to carry out, and its ways to approve it. */
const plan: Question = {
  id: 2,
  kind: 'tool',
  agent: 'Claude Code',
  params: {
    toolCall: {
      title: 'Approve Plan',
      rawInput: {
        plan: '# Pricing card\n\n## Plan\n1. Read the page to find free space.\n2. Render a 320×420 card with a **title**, a price, and a button.\n3. Select it and zoom to it.'
      }
    },
    options: [
      { optionId: 'default', name: 'Yes, manually approve edits', kind: 'allow_once' },
      { optionId: 'auto', name: 'Yes, and use auto mode', kind: 'allow_once' },
      { optionId: 'plan', name: 'No, keep planning', kind: 'reject_once' }
    ]
  }
}

const mode: Question = { id: 3, kind: 'mode', agent: 'Codex', mode: 'agent-full-access' }

const file: Question = {
  id: 4,
  kind: 'file',
  client: 'claude-code',
  tool: 'save_document',
  write: true,
  path: '/Users/me/Designs/pricing.fig'
}

type Args = { question: Question; waiting?: number; onAnswer?: (option: string | null) => void }
type Story = StoryObj<Args>

const meta = {
  title: 'App/Shell/Permission Question',
  component: PermissionQuestion,
  parameters: { layout: 'centered' },
  args: { onAnswer: fn() },
  render: (args) => ({
    components: { PermissionQuestion },
    setup: () => ({ args }),
    // The size the permission window opens at.
    template:
      '<div class="h-105 w-110 overflow-hidden rounded-lg border border-border"><PermissionQuestion v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta

export const Tool: Story = {
  args: { question: tool, waiting: 2 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Claude Code asks to use Bash/)).toBeVisible()
    await expect(canvas.getByText(/2 more waiting/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Reject' }))
    await expect(args.onAnswer).toHaveBeenCalledWith('reject')
  }
}

export const Plan: Story = { args: { question: plan } }

export const Mode: Story = {
  args: { question: mode },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Keep asking' }))
    await expect(args.onAnswer).toHaveBeenCalledWith(null)
  }
}

export const File: Story = {
  args: { question: file },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/claude-code asks to write \/Users\/me\/Designs/)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Allow' }))
    await expect(args.onAnswer).toHaveBeenCalledWith('allow')
  }
}

export const FileFromUnnamedClient: Story = {
  args: { question: { ...file, client: '', write: false, tool: 'import_image' } }
}
