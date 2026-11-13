import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import CloudTrashView from './CloudTrashView.vue'
import type { CloudTrashRow } from './types'

const documents: CloudTrashRow[] = [
  {
    id: 'landing',
    name: 'Landing page',
    kind: 'design',
    metadata: 'Design team · Deleted 2 hr. ago by Ana Duarte',
    daysLeft: 30,
    canPurge: true
  },
  {
    id: 'retro',
    name: 'Sprint retro',
    kind: 'board',
    metadata: 'Design team · Deleted 6 days ago by Ben Ortiz',
    daysLeft: 24,
    canPurge: false
  },
  {
    id: 'icons',
    name: 'Icons — an older exploration with a name long enough to be cut short',
    kind: 'design',
    metadata: 'Personal · Deleted Oct 12',
    daysLeft: 1,
    canPurge: true
  }
]

const meta = {
  title: 'App/Home/Cloud Trash',
  parameters: { layout: 'fullscreen' },
  args: {
    documents,
    state: 'ready',
    busy: null,
    onRestore: fn(),
    onPurge: fn(),
    onRefresh: fn()
  },
  render: (args) => ({
    components: { CloudTrashView },
    setup: () => ({ args }),
    template:
      '<div class="min-h-screen bg-panel p-6 text-surface"><CloudTrashView v-bind="args" /></div>'
  })
} satisfies Meta<{
  documents: CloudTrashRow[]
  state: 'loading' | 'ready' | 'error'
  busy: string | null
  onRestore: (document: CloudTrashRow) => void
  onPurge: (document: CloudTrashRow) => void
  onRefresh: () => void
}>

export default meta
type Story = StoryObj<typeof meta>

/** Restore for every file; Delete forever only where the person may, such as their own. */
export const Ready: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const rows = canvas.getAllByRole('listitem')
    await expect(rows).toHaveLength(3)
    await userEvent.click(within(rows[0]).getByRole('button', { name: 'Restore' }))
    await expect(args.onRestore).toHaveBeenCalledWith(documents[0])
    await expect(within(rows[1]).queryByRole('button', { name: 'Delete forever' })).toBeNull()
    await userEvent.click(within(rows[2]).getByRole('button', { name: 'Delete forever' }))
    await expect(args.onPurge).toHaveBeenCalledWith(documents[2])
    await expect(canvas.getByText('1 day left')).toBeVisible()
  }
}

/** A file being restored waits; the others stay usable. */
export const Restoring: Story = { args: { busy: 'landing' } }

export const Empty: Story = {
  args: { documents: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Trash is empty')).toBeVisible()
  }
}

export const Loading: Story = { args: { documents: [], state: 'loading' } }

export const LoadFailed: Story = {
  args: { documents: [], state: 'error' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Couldn’t load Trash')).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRefresh).toHaveBeenCalled()
  }
}
