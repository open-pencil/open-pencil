import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { CampaignContent } from '@open-pencil/feedback/contract'

import { provideCollabPanel } from '@/components/collab-panel/context'
import ShareOrJoinRoom from '@/components/collab-panel/ShareOrJoinRoom.vue'
import { shareButton } from '@/components/collab-panel/ui'
import CloudSettingsPanel from '@/components/settings/cloud/CloudSettingsPanel.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import MediaSettingsPanel from '@/components/settings/media/MediaSettingsPanel.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
import UsageSettingsPanel from '@/components/settings/usage/UsageSettingsPanel.vue'
import { floatingSurface } from '@/theme/overlay'

import CampaignNote from './CampaignNote.vue'
import type { CampaignViewArgs } from './types'

/**
 * One story per placement, with copy standing in for what the server would send. Each note sits
 * where its placement puts it, above the real panel it belongs to: the settings panels draw their
 * own page, so a note at the top of a tab is composed above it here with the page's padding.
 */
const placements = {
  cloud: {
    title: 'OpenPencil Cloud',
    body: 'Sign in to keep your designs **in sync across devices**, share a link and edit together live, and use AI and web search with monthly credits.',
    action: { label: 'Create a free account', url: 'https://openpencil.dev/pricing' }
  },
  models: {
    title: 'No API key?',
    body: 'Use OpenPencil’s AI with Cloud credits — no provider account needed. [How credits work](https://openpencil.dev/pricing)',
    action: { label: 'Try Cloud', url: 'https://openpencil.dev/pricing' }
  },
  integrations: {
    title: 'Web search included',
    body: 'Web search is included with OpenPencil Cloud — no Exa key needed.',
    action: { label: 'See plans', url: 'https://openpencil.dev/pricing' }
  },
  usage: {
    title: 'One bill for AI',
    body: 'With Cloud, AI is billed in credits instead of per-provider keys.',
    action: { label: 'See plans', url: 'https://openpencil.dev/pricing' }
  },
  share: {
    title: 'Share with a link',
    body: 'Sharing a link needs OpenPencil Cloud. Your file stays yours; Cloud keeps it in sync.',
    action: { label: 'Try Cloud', url: 'https://openpencil.dev/pricing' }
  }
} satisfies Record<string, CampaignContent>

type Args = CampaignViewArgs

const note = `
  <CampaignNote
    :content="args.content"
    :kind="args.kind"
    @dismiss="args.onDismiss"
    @act="args.onAct"
  />`

/** A Settings tab: the real panel, with the note in its `campaign` slot, where it scrolls with the page. */
const settingsTab = (panel: string) => `
  <div class="flex h-140 w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-panel">
    <${panel}><template #campaign>${note}</template></${panel.split(' ')[0]}>
  </div>`

const meta = {
  title: 'App/Shell/Campaign Note',
  component: CampaignNote,
  tags: ['autodocs'],
  args: { content: placements.cloud, kind: 'cloud', onDismiss: fn(), onAct: fn() },
  render: (args) => ({
    components: { CampaignNote },
    setup: () => ({ args }),
    template: `<div class="max-w-md">${note}</div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** The note alone, as each placement draws it. */
export const Note: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Create a free account' }))
    await expect(args.onAct).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Dismiss' }))
    await expect(args.onDismiss).toHaveBeenCalled()
  }
}

/** `settings-cloud`: at the top of Settings › Cloud, for an install that is signed out. */
export const SettingsCloud: Story = {
  render: (args) => ({
    components: { CampaignNote, CloudSettingsPanel },
    setup: () => ({ args }),
    template: settingsTab('CloudSettingsPanel :servers="[]"')
  })
}

/** `settings-models`: in Settings › Models, beside bringing a provider key. */
export const SettingsModels: Story = {
  args: { content: placements.models },
  render: (args) => ({
    components: { CampaignNote, ModelsPanel },
    setup: () => ({ args }),
    template: settingsTab('ModelsPanel')
  })
}

/** `settings-integrations`: in Settings › Integrations, beside web search. */
export const SettingsIntegrations: Story = {
  args: { content: placements.integrations },
  render: (args) => ({
    components: { CampaignNote, MediaSettingsPanel },
    setup: () => ({ args }),
    template: settingsTab('MediaSettingsPanel')
  })
}

/** `settings-usage`: in Settings › Usage, under its heading, above the usage history. */
export const SettingsUsage: Story = {
  args: { content: placements.usage },
  render: (args) => ({
    components: { CampaignNote, SettingsPage, UsageSettingsPanel },
    setup: () => ({ args }),
    template: `
      <div class="flex h-140 w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-panel">
        <SettingsPage>
          <UsageSettingsPanel><template #campaign>${note}</template></UsageSettingsPanel>
        </SettingsPage>
      </div>`
  })
}

/**
 * `share`: in the Share popover of a document that is not in Cloud, above sharing it live. The
 * popover's surface is drawn open here around the real popover content.
 */
export const Share: Story = {
  args: { content: placements.share },
  render: (args) => ({
    components: { CampaignNote, ShareOrJoinRoom },
    setup() {
      provideCollabPanel()
      return { args, shareButton: shareButton(), surface: floatingSurface }
    },
    template: `
      <div class="flex w-72 flex-col items-end gap-2">
        <button type="button" :class="shareButton">Share</button>
        <div :class="[surface, 'flex w-72 flex-col gap-3 p-3']">
          ${note}
          <div><ShareOrJoinRoom /></div>
        </div>
      </div>`
  })
}
