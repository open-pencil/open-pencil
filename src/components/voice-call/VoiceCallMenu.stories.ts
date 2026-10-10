import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { VoiceCallError } from '@/app/collab/voice/call'
import { room } from '@/components/presence/examples/room'
import type { PresencePersonRow } from '@/components/presence/rows'

import type { VoiceDeviceOption } from './useVoiceCallControl'
import VoiceCallMenu from './VoiceCallMenu.vue'

const [you, ana, ben] = room

const microphones = [
  { value: 'default', label: 'System default' },
  { value: 'built-in', label: 'MacBook Pro Microphone' },
  { value: 'headset', label: 'AirPods Pro' }
]
const speakers = [
  { value: 'default', label: 'System default' },
  { value: 'built-in', label: 'MacBook Pro Speakers' }
]

type Args = {
  people: PresencePersonRow[]
  inCall?: boolean
  othersInCall?: number
  muted?: boolean
  joining?: boolean
  error?: VoiceCallError | null
  microphones: VoiceDeviceOption[]
  speakers?: VoiceDeviceOption[]
  microphone: string
  speaker: string
  onJoin: () => void
  onToggleMute: () => void
  onLeave: () => void
  onClose: () => void
}

function inCall(row: PresencePersonRow | undefined, muted: boolean, speaking: boolean) {
  return row ? [{ ...row, voice: { muted, speaking } }] : []
}

const meta = {
  title: 'App/Collaboration/Voice Call',
  component: VoiceCallMenu,
  args: {
    people: [],
    microphones,
    speakers,
    microphone: 'default',
    speaker: 'default',
    onJoin: fn(),
    onToggleMute: fn(),
    onLeave: fn(),
    onClose: fn()
  },
  render: (args) => ({
    components: { VoiceCallMenu },
    setup: () => ({ args }),
    template:
      '<div class="flex justify-end bg-panel p-3 pb-96"><VoiceCallMenu v-bind="args" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** Nobody is in the room's call yet. */
export const Idle: Story = {}

/** Others are talking; the button counts them and joins their call. */
export const OthersInCall: Story = {
  args: {
    people: [...inCall(ana, false, true), ...inCall(ben, true, false)],
    othersInCall: 2
  },
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Join voice call' }))
    const popover = within(await within(document.body).findByRole('dialog'))
    await userEvent.click(popover.getByRole('button', { name: 'Join voice call' }))
    await expect(args.onJoin).toHaveBeenCalledOnce()
  }
}

/** In the call and muted: mute leads, and the popover holds the devices and Leave. */
export const InCallMuted: Story = {
  args: {
    people: [...inCall(you, true, false), ...inCall(ana, false, true)],
    othersInCall: 1,
    inCall: true,
    muted: true
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Unmute' }))
    await expect(args.onToggleMute).toHaveBeenCalledOnce()
    await userEvent.click(canvas.getByRole('button', { name: 'Voice call' }))
    const popover = within(await within(document.body).findByRole('dialog'))
    await userEvent.click(popover.getByRole('button', { name: 'Leave call' }))
    await expect(args.onLeave).toHaveBeenCalledOnce()
  }
}

/** The microphone was blocked, so the popover says how to allow it and offers another. */
export const MicrophoneBlocked: Story = {
  args: { error: 'denied' },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Start voice call' }))
    await expect(await within(document.body).findByRole('alert')).toBeVisible()
  }
}

/** Browsers without `setSinkId` play through the system's speakers and offer no choice. */
export const NoSpeakerChoice: Story = {
  args: { speakers: undefined }
}
