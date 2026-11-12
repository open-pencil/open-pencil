import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, waitFor } from 'storybook/test'

import type { Project } from '@/app/projects/schema'
import type { ProjectStatus } from '@/app/projects/status'
import type { ProjectAddFailure } from '@/app/projects/use'
import ProjectsSection from '@/components/home/projects/ProjectsSection.vue'

/** The section's props, named here so the stories do not depend on SFC type inference. */
type SectionArgs = {
  projects: Project[]
  statuses: Record<string, ProjectStatus>
  busy: boolean
  failure: ProjectAddFailure | null
}

const karbid: Project = {
  id: 'project-karbid2',
  name: 'Karbid2',
  repository: 'D:/Karbid2',
  appDirectory: 'code',
  startCommand: 'npm run dev',
  startUrl: 'http://127.0.0.1:3000'
}

const pencil: Project = {
  id: 'project-openpencil',
  name: 'OpenPencil',
  repository: 'D:/OpenPencilDev-src',
  appDirectory: '',
  startCommand: 'bun run dev',
  startUrl: 'http://localhost:1420'
}

const statuses: Record<string, ProjectStatus> = {
  [karbid.id]: { branch: 'main', changed: 0 },
  [pencil.id]: { branch: 'feat/git-sync', changed: 16 }
}

const notRepository: ProjectAddFailure = { kind: 'notRepository' }

const meta = {
  title: 'App/Home/Projects',
  component: ProjectsSection,
  parameters: {
    docs: {
      description: {
        component:
          'The projects Home lists, with the branch and changes git reports for each. A row opens its project, renames it in place, or asks before it leaves the list; the repository itself is never touched. The section renders the list; useProjectImport picks a folder and stores the project, and useProjectStatuses reads every listed repository.'
      }
    }
  },
  args: { projects: [], statuses: {}, busy: false, failure: null },
  render: (args: SectionArgs) => ({
    components: { ProjectsSection },
    setup: () => ({ args }),
    template:
      '<div class="max-w-2xl bg-canvas p-4 text-surface"><ProjectsSection v-bind="args" /></div>'
  })
} satisfies Meta<SectionArgs>

export default meta
type Story = StoryObj<SectionArgs>

export const Empty: Story = {}

export const WithProjects: Story = { args: { projects: [karbid, pencil], statuses } }

export const WithoutGit: Story = { args: { projects: [karbid, pencil] } }

export const Adding: Story = { args: { projects: [karbid], statuses, busy: true } }

/** Renaming happens in the row: the name becomes a field the person types in. */
export const Renaming: Story = {
  args: { projects: [karbid, pencil], statuses },
  play: async ({ canvasElement }) => {
    // Selected by test id, since the labels are translated into whatever locale renders.
    const rename = canvasElement.querySelector<HTMLButtonElement>(
      `[data-test-id="project-rename-${karbid.id}"]`
    )
    if (!rename) throw new Error('The row offers no rename action')
    await userEvent.click(rename)
    await waitFor(() => {
      const field = canvasElement.querySelector<HTMLInputElement>(
        `[data-test-id="project-name-${karbid.id}"]`
      )
      if (field?.value !== karbid.name) throw new Error('The name field did not open')
    })
  }
}

export const NotARepository: Story = {
  args: { projects: [karbid], statuses, failure: notRepository }
}

export const GitMissing: Story = { args: { failure: { kind: 'unavailable' } } }

export const AddFailed: Story = {
  args: { failure: { kind: 'failed', reason: 'Access is denied. (os error 5)' } }
}
