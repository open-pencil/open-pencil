import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { CampaignContent } from '@open-pencil/feedback/contract'

import CampaignPrompt from './CampaignPrompt.vue'

/** Campaign copy is the server's; these stand in for what it would send. */
const cloudOffer: CampaignContent = {
  title: 'Try OpenPencil Cloud',
  body: 'Keep your designs **in sync across devices**, share a link, and edit together live. AI and web search come with monthly credits. [See plans](https://openpencil.dev/pricing)',
  action: { label: 'Try Cloud', url: 'https://openpencil.dev/pricing' }
}

const donationAsk: CampaignContent = {
  title: 'Support OpenPencil',
  body: 'Enjoying OpenPencil? It’s free and open source, and a donation helps speed up its development and covers the servers and services it runs on.',
  action: { label: 'Donate', url: 'https://openpencil.dev/donate' }
}

const disallowedLink: CampaignContent = {
  title: 'Try OpenPencil Cloud',
  body: 'Read more on [our partner’s site](https://example.com), or at https://example.com/cloud. Only [openpencil.dev](https://openpencil.dev/pricing) opens as a link.',
  action: { label: 'Try Cloud', url: 'https://openpencil.dev/pricing' }
}

type Args = {
  content: CampaignContent
  kind?: string
  onDismiss: () => void
  onAct: () => void
}

const meta = {
  title: 'App/Shell/Campaign Prompt',
  component: CampaignPrompt,
  tags: ['autodocs'],
  args: { content: cloudOffer, kind: 'cloud', onDismiss: fn(), onAct: fn() },
  render: (args) => ({
    components: { CampaignPrompt },
    setup: () => ({ args }),
    template: `
      <div class="h-80">
        <CampaignPrompt
          :content="args.content"
          :kind="args.kind"
          @dismiss="args.onDismiss"
          @act="args.onAct"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const CloudOffer: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'See plans' })).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Try Cloud' }))
    await expect(args.onAct).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Not now' }))
    await expect(args.onDismiss).toHaveBeenCalled()
  }
}

/** The donation ask, sent as a campaign rather than built into the app. */
export const DonationAsk: Story = {
  args: { content: donationAsk, kind: 'donation' }
}

/** A campaign without an action offers only Not now. */
export const WithoutAction: Story = {
  args: {
    content: {
      title: 'OpenPencil 2.0 is out',
      body: 'Variables, *auto layout* everywhere, and a faster canvas. Thanks for using OpenPencil.'
    },
    kind: 'release'
  }
}

/** A link off openpencil.dev, written or bare, shows as its text and opens nothing. */
export const DisallowedLink: Story = {
  args: { content: disallowedLink },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('link', { name: 'openpencil.dev' })).toBeVisible()
    await expect(canvas.getByText('our partner’s site')).toBeVisible()
    await expect(canvas.queryByRole('link', { name: 'our partner’s site' })).toBeNull()
    await expect(canvas.getAllByRole('link')).toHaveLength(1)
  }
}

/** Raw HTML, images, and inline components in a campaign stay text or draw nothing. */
export const MarkupStaysText: Story = {
  args: {
    content: {
      title: 'Try OpenPencil Cloud',
      body: 'Plain <b>HTML</b> stays text. ![A tracking pixel](https://example.com/pixel.png) :iframe{src="https://example.com"}',
      action: { label: 'Try Cloud', url: 'https://openpencil.dev/pricing' }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByText(/Plain <b>HTML<\/b> stays text/)).toBeVisible()
    await expect(canvasElement.querySelector('img, iframe, b')).toBeNull()
  }
}
