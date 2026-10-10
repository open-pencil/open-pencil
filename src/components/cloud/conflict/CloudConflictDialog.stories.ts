import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import { previewDocuments } from '@/components/home/cloud/preview-data'

import CloudConflictDialog from './CloudConflictDialog.vue'
import type { ConflictChoice } from './types'

type Args = { choice: ConflictChoice; onConfirm: (choice: ConflictChoice) => void }

const meta = {
  title: 'App/Cloud/Conflict Dialog',
  tags: ['autodocs'],
  args: { choice: 'keep-both', onConfirm: fn() },
  render: (args) => ({
    components: { CloudConflictDialog },
    setup: () => ({
      args,
      choice: ref(args.choice),
      mine: {
        previewURL: previewDocuments[2]?.previewURL,
        by: 'You, on this device',
        savedAgo: '12 min ago'
      },
      cloud: { previewURL: previewDocuments[0]?.previewURL, by: 'Ben', savedAgo: '5 min ago' }
    }),
    template: `
      <div class="h-[700px]">
        <CloudConflictDialog :open="true" v-model:choice="choice" document-name="Pricing page" :mine="mine" :cloud="cloud" @confirm="args.onConfirm" />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const KeepBoth: Story = {}
export const ReplaceCloudVersion: Story = { args: { choice: 'use-mine' } }
