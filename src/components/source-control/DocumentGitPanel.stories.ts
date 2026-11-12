import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, waitFor } from 'storybook/test'

import type { GitFailure } from '@/app/integrations/git/client'
import type {
  GitBranch,
  GitBranchState,
  GitCommitSummary,
  GitFileState
} from '@/app/integrations/git/schema'
import DocumentGitPanel from '@/components/source-control/DocumentGitPanel.vue'

/** The panel's props, named here so the stories do not depend on SFC type inference. */
type Args = {
  path: string | null
  branch: GitBranchState | null
  state: GitFileState | null
  branches: GitBranch[]
  others: number
  history: GitCommitSummary[]
  historyLoaded: boolean
  busy: boolean
  failure: GitFailure | null
  commitMessage: string
  versioned: boolean
  canCommit: boolean
}

const branch: GitBranchState = {
  head: 'main',
  oid: '6b6a9a1',
  upstream: 'origin/main',
  detached: false,
  ahead: 1,
  behind: 0
}

const branches: GitBranch[] = [
  { name: 'main', current: true },
  { name: 'feat/catalog', current: false },
  { name: 'feat/tokens', current: false }
]

const history: GitCommitSummary[] = [
  {
    hash: '4f3c2b1a9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a',
    author: 'Сергей',
    date: '2026-11-07T18:24:00+03:00',
    subject: 'feat(catalog): карточки товаров'
  },
  {
    hash: '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d',
    author: 'Сергей',
    date: '2026-11-05T12:02:00+03:00',
    subject: 'fix(catalog): выравнивание сетки'
  }
]

const failure: GitFailure = {
  ok: false,
  code: 1,
  stderr: 'error: Your local changes would be overwritten by merge.',
  summary: 'error: Your local changes would be overwritten by merge.'
}

const meta = {
  title: 'App/Source Control/Document',
  component: DocumentGitPanel,
  parameters: {
    docs: {
      description: {
        component:
          'Version control for the open document: the branch its repository is on, how the file itself stands against the last commit, and the actions that touch that file alone. `useDocumentGit` finds the repository from the file, so nothing has to be registered first.'
      }
    }
  },
  args: {
    path: 'designs/site/design/catalog.fig',
    branch,
    state: 'modified',
    branches,
    others: 2,
    history,
    historyLoaded: true,
    busy: false,
    failure: null,
    commitMessage: 'feat(catalog): карточки товаров',
    versioned: true,
    canCommit: true
  },
  render: (args: Args) => ({
    components: { DocumentGitPanel },
    setup: () => ({ args }),
    template:
      '<div class="h-120 w-120 bg-panel text-surface"><DocumentGitPanel v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<Args>

export const Modified: Story = {}

export const Clean: Story = {
  args: { state: 'clean', others: 0, canCommit: false, commitMessage: '' }
}

/** A document that has never been written to a file has nothing git could commit. */
export const NeverSaved: Story = {
  args: {
    path: null,
    branch: null,
    state: null,
    branches: [],
    others: 0,
    history: [],
    versioned: false,
    canCommit: false,
    commitMessage: ''
  }
}

/** A file outside a repository: git is installed, but there is nothing to version it with. */
export const OutsideRepository: Story = {
  args: { versioned: false, branch: null, state: null, branches: [], others: 0, history: [] }
}

export const NoHistory: Story = {
  args: { history: [], state: 'untracked', canCommit: true }
}

export const Failed: Story = { args: { failure } }

/** Restoring asks first, since the version replaces what the document holds. */
export const Restoring: Story = {
  play: async ({ canvasElement }) => {
    const restore = canvasElement.querySelector<HTMLButtonElement>(
      '[data-test-id="document-git-restore"]'
    )
    if (!restore) throw new Error('The history offers no restore action')
    await userEvent.click(restore)
    // The dialog renders in a portal on the document body.
    await waitFor(() => {
      if (!canvasElement.ownerDocument.querySelector('[role="alertdialog"]')) {
        throw new Error('The restore confirmation did not open')
      }
    })
  }
}
