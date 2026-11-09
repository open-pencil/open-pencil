import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, waitFor, within } from 'storybook/test'
import { ref } from 'vue'

import type { Project } from '@/app/projects/schema'
import ProjectDeleteDialog from '@/components/home/projects/ProjectDeleteDialog.vue'

const karbid: Project = {
  id: 'project-karbid2',
  name: 'Karbid2',
  repository: 'D:/Karbid2',
  appDirectory: 'code',
  startCommand: 'npm run dev',
  startUrl: 'http://127.0.0.1:3000'
}

type Args = { project: Project | null; onConfirm: (id: string) => void }

const meta = {
  title: 'App/Home/Projects/Remove dialog',
  component: ProjectDeleteDialog,
  parameters: {
    docs: {
      description: {
        component:
          'Confirms that a project leaves the list. The repository stays on disk, so the dialog says so instead of implying the files go away.'
      }
    }
  },
  args: { project: karbid, onConfirm: fn() },
  render: (args: Args) => ({
    components: { ProjectDeleteDialog },
    setup: () => ({ args, project: ref(args.project) }),
    template:
      '<div class="h-70"><ProjectDeleteDialog v-model:project="project" @confirm="args.onConfirm" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Args>

export const Asked: Story = {
  play: async ({ canvasElement }) => {
    // The dialog renders in a portal on the document body.
    const dialog = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(dialog.getByRole('alertdialog')).toBeVisible())
  }
}
