import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { ReleaseInfo, UpdaterState } from '@/app/shell/updater/session'

import UpdatePrompt from './UpdatePrompt.vue'

const release: ReleaseInfo = {
  version: '0.15.1',
  currentVersion: '0.15.0',
  notes: `### Added

- Configure built-in AI and local MCP tool access independently on a **Tool access** page, including optional extended AI tools and per-target defaults (#584).
- Set the built-in AI's maximum steps per message in Chat settings (#573).
- Open documents and jump to a named layer from \`openpencil://open?file=&node=\` links.

### Changed

- Create new documents with the sRGB colour profile, so Display P3 is reserved for documents that declare it.
- Export diagnostics from Settings only, with a retention count you choose.

### Fixed

- Store colours edited in the colour picker in the document's colour profile, and convert them on the way to the display.
- Let the desktop app use an MCP server you started yourself by allowing the app's own origin by default, instead of requiring \`OPENPENCIL_MCP_CORS_ORIGIN\`.
- Mark unsaved documents and ask whether to save before closing a tab, the desktop window, or the application.
- Update instance text properties on the canvas while typing, with grouped undo for rapid edits.
- Point Homebrew installation instructions to the official [\`openpencil\` cask](https://formulae.brew.sh/cask/openpencil).

### Performance

- Reduce editor pauses while generating recovery snapshots and exporting text-heavy \`.fig\` documents.
- Recompute layout only for the pages an edit affects, instead of every page.`
}

type Args = { state: UpdaterState; currentVersion: string; installQuitsApp?: boolean }
type Story = StoryObj<Args>

const meta = {
  title: 'Shell/Update Prompt',
  component: UpdatePrompt,
  parameters: { layout: 'centered' },
  args: { currentVersion: '0.15.0' },
  render: (args) => ({
    components: { UpdatePrompt },
    setup: () => ({ args }),
    // The size the Software Update window opens at.
    template:
      '<div class="h-[520px] w-[560px] overflow-hidden rounded-lg border border-border"><UpdatePrompt v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta

export const Available: Story = {
  args: { state: { status: 'available', release } }
}

export const WithoutNotes: Story = {
  args: { state: { status: 'available', release: { ...release, notes: '' } } }
}

export const Downloading: Story = {
  args: {
    state: {
      status: 'downloading',
      release,
      progress: { downloaded: 23_500_000, total: 61_200_000 }
    }
  }
}

export const DownloadingUnknownSize: Story = {
  args: { state: { status: 'downloading', release, progress: { downloaded: 23_500_000 } } }
}

export const AvailableOnWindows: Story = {
  args: { state: { status: 'available', release }, installQuitsApp: true }
}

export const DownloadFailed: Story = {
  args: {
    state: { status: 'failed', step: 'download', release, error: 'connection reset' }
  }
}

export const Installed: Story = {
  args: { state: { status: 'installed', release } }
}

export const Installing: Story = {
  args: { state: { status: 'installing', release } }
}

export const InstallFailed: Story = {
  args: {
    state: { status: 'failed', step: 'install', release, error: 'signature verification failed' }
  }
}

export const Checking: Story = {
  args: { state: { status: 'checking' } }
}

export const UpToDate: Story = {
  args: { state: { status: 'up-to-date' } }
}

export const CheckFailed: Story = {
  args: { state: { status: 'failed', step: 'check', error: 'network unreachable' } }
}
