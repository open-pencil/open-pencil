import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { GitFailure } from '@/app/integrations/git/client'
import type { GitAvailability, GitBranch, GitStatus } from '@/app/integrations/git/schema'
import type { GitDiff } from '@/app/integrations/git/use'
import SourceControlPanel from '@/components/source-control/SourceControlPanel.vue'

/** The panel's props, named here so the stories do not depend on SFC type inference. */
type PanelArgs = {
  availability: GitAvailability | null
  status: GitStatus | null
  branches: GitBranch[]
  failure: GitFailure | null
  busy: boolean
  commitMessage: string
  diff: GitDiff | null
  compareLink: string | null
}

const availability: GitAvailability = {
  available: true,
  version: 'git version 2.56.0',
  path: 'C:/Program Files/Git/bin/git.exe'
}

const cleanStatus: GitStatus = {
  branch: {
    head: 'main',
    oid: '6b6a9a1',
    upstream: 'origin/main',
    detached: false,
    ahead: 2,
    behind: 1
  },
  entries: []
}

const changedStatus: GitStatus = {
  branch: {
    head: 'feat/git-sync',
    oid: '6b6a9a1',
    upstream: null,
    detached: false,
    ahead: 0,
    behind: 0
  },
  entries: [
    {
      kind: 'changed',
      index: 'M',
      worktree: '.',
      path: 'code/packages/ui-vue3/src/components/Button.vue'
    },
    {
      kind: 'changed',
      index: '.',
      worktree: 'M',
      path: 'designs/site/project/tokens.json'
    },
    {
      kind: 'renamed',
      index: 'R',
      worktree: '.',
      path: 'src/moved.ts',
      originalPath: 'src/old.ts'
    },
    { kind: 'untracked', index: '.', worktree: '.', path: 'scratch/notes.md' }
  ]
}

const hookFailure: GitFailure = {
  ok: false,
  code: 1,
  stderr: 'pre-commit: пересобери токены (cd code && npm run build:tokens)',
  summary: 'pre-commit: пересобери токены (cd code && npm run build:tokens)'
}

const meta = {
  title: 'App/Source Control/Panel',
  component: SourceControlPanel,
  parameters: {
    docs: {
      description: {
        component:
          "State and actions of one project's source control. The panel renders; useSourceControl owns the repository, its status, and every git operation."
      }
    }
  },
  args: {
    availability,
    status: null,
    branches: [],
    failure: null,
    busy: false,
    commitMessage: '',
    diff: null,
    compareLink: null
  },
  render: (args: PanelArgs) => ({
    components: { SourceControlPanel },
    setup: () => ({ args }),
    template:
      '<div class="h-96 w-80 bg-panel p-4 text-surface"><SourceControlPanel v-bind="args" /></div>'
  })
} satisfies Meta<PanelArgs>

export default meta
type Story = StoryObj<PanelArgs>

export const GitMissing: Story = { args: { availability: null } }

export const Clean: Story = { args: { status: cleanStatus } }

export const WithChanges: Story = {
  args: {
    status: changedStatus,
    branches: [
      { name: 'main', current: false },
      { name: 'feat/git-sync', current: true }
    ],
    commitMessage: 'feat: align button padding with the spacing scale'
  }
}

const patch: GitDiff = {
  path: 'code/packages/ui-vue3/src/components/Button.vue',
  kind: 'changed',
  reading: false,
  patch: [
    'diff --git a/code/packages/ui-vue3/src/components/Button.vue b/code/packages/ui-vue3/src/components/Button.vue',
    'index 1a2b3c4..5d6e7f8 100644',
    '--- a/code/packages/ui-vue3/src/components/Button.vue',
    '+++ b/code/packages/ui-vue3/src/components/Button.vue',
    '@@ -12,7 +12,7 @@ defineProps<{',
    '   <button',
    '-    class="px-3 py-1.5"',
    '+    class="px-4 py-2"',
    '     :disabled="disabled"',
    '   >'
  ].join('\n')
}

export const ReadingDiff: Story = {
  args: {
    status: changedStatus,
    diff: { path: patch.path, kind: 'changed', patch: '', reading: true }
  }
}

export const UntrackedFile: Story = {
  args: {
    status: changedStatus,
    diff: { path: 'scratch/notes.md', kind: 'untracked', patch: '', reading: false }
  }
}

export const HookRefused: Story = {
  args: {
    status: changedStatus,
    commitMessage: 'chore: rebuild tokens',
    failure: hookFailure
  }
}

export const PullRequestReady: Story = {
  args: {
    status: changedStatus,
    compareLink: 'https://github.com/acme/site/compare/main...feat/git-sync?expand=1'
  }
}
