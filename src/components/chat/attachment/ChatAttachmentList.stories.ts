import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { toUint8Array } from 'js-base64'

import type { AttachmentPresentation } from '@/app/ai/attachment/presentation/types'

import ChatAttachmentList from './ChatAttachmentList.vue'

const pixel = new Blob(
  [
    Uint8Array.from(
      toUint8Array(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69cbGAAAAABJRU5ErkJggg=='
      )
    )
  ],
  { type: 'image/png' }
)

const image: AttachmentPresentation = {
  id: 'image',
  messageId: 'message',
  kind: 'image',
  name: 'reference.png',
  preview: pixel,
  mediaType: 'image/png',
  originalSize: { x: 1280, y: 720 }
}

const node: AttachmentPresentation = {
  id: 'node',
  messageId: 'message',
  kind: 'node',
  name: 'Checkout card',
  preview: pixel,
  nodeId: '12:34',
  nodeType: 'FRAME',
  originalSize: { x: 320, y: 240 }
}

type AttachmentListStoryArgs = {
  attachments: AttachmentPresentation[]
}

const meta = {
  title: 'App/Chat/Attachments',
  component: ChatAttachmentList,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { ChatAttachmentList },
    setup: () => ({ args }),
    template: '<div class="w-96 rounded-xl bg-panel p-3"><ChatAttachmentList v-bind="args" /></div>'
  })
} satisfies Meta<AttachmentListStoryArgs>

export default meta
type Story = StoryObj<AttachmentListStoryArgs>

export const Image: Story = { args: { attachments: [image] } }
export const Node: Story = { args: { attachments: [node] } }
export const Mixed: Story = { args: { attachments: [node, image] } }
