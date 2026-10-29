import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconPlus from '~icons/lucide/plus'
import IconSearch from '~icons/lucide/search'
import IconUsers from '~icons/lucide/users'

import HomeLayout from '@/components/home/HomeLayout.vue'
import HomeSearchActions from '@/components/home/search/HomeSearchActions.vue'
import HomeLocationMenu from '@/components/home/sidebar/HomeLocationMenu.vue'
import HomeSidebar from '@/components/home/sidebar/HomeSidebar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'

import CloudWorkspaceView from './CloudWorkspaceView.vue'
import { previewDocuments } from './preview-data'
import type { CloudDocumentRow, HomeCloudAccount, HomeLocation } from './types'

type Args = {
  account: HomeCloudAccount | null
  active: HomeLocation
  title: string
  subtitle?: string
  role?: string | null
  documents: CloudDocumentRow[]
  state: 'loading' | 'ready' | 'offline' | 'error'
  usage: { usedBytes: number; totalBytes: number | null } | null
  onOpen: (document: CloudDocumentRow) => void
  realActions?: boolean
}

const account: HomeCloudAccount = {
  id: 'user-ana',
  name: 'Ana Duarte',
  email: 'ana@studio.example',
  host: 'cloud.openpencil.dev'
}
const workspaces = [
  { id: 'design', name: 'Design team', documentCount: 6, attention: true },
  { id: 'personal', name: 'Personal', documentCount: 12 }
]
const synced = previewDocuments.map((document) =>
  document.sync === 'conflict' ? { ...document, sync: 'synced' as const } : document
)

const meta = {
  title: 'App/Home/Cloud Home',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    account,
    active: { kind: 'workspace', id: 'design' },
    title: 'Design team',
    subtitle: '6 files',
    role: 'Editor',
    documents: synced,
    state: 'ready',
    usage: { usedBytes: 2.1 * 1024 ** 3, totalBytes: 10 * 1024 ** 3 },
    onOpen: fn()
  },
  render: (args) => ({
    components: {
      HomeLayout,
      HomeSearchActions,
      HomeLocationMenu,
      HomeSidebar,
      CloudWorkspaceView,
      AppButton,
      AppInput,
      IconFolderOpen,
      IconPlus,
      IconSearch,
      IconUsers
    },
    setup: () => ({ args, workspaces, query: ref(''), view: ref<'grid' | 'list'>('grid') }),
    template: `
      <div :class="['flex h-dvh max-h-[760px] flex-col', args.realActions && '-m-8 max-h-none']">
        <HomeLayout>
          <template #sidebar>
            <HomeSidebar
              :active="args.active"
              :account="args.account"
              :workspaces="args.account ? workspaces : []"
              :shared-count="3"
              :storage="{ label: 'Studio bucket', detail: 'R2' }"
            />
          </template>
          <template #locations>
            <HomeLocationMenu
              :active="args.active"
              :account="args.account"
              :workspaces="args.account ? workspaces : []"
              :shared-count="3"
              :storage="{ label: 'Studio bucket', detail: 'R2' }"
            />
          </template>
          <HomeSearchActions v-if="args.realActions" v-model="query" />
          <div v-else class="mb-6 flex items-center gap-3">
            <AppInput v-model="query" type="search" density="compact" class="flex-1" placeholder="Search files…" aria-label="Search files">
              <template #leading><IconSearch class="size-4" /></template>
            </AppInput>
            <AppButton variant="outline"><template #leading><IconUsers class="size-3.5" /></template>Join room…</AppButton>
            <AppButton variant="outline"><template #leading><IconFolderOpen class="size-3.5" /></template>Open…</AppButton>
            <AppButton color="primary" variant="solid"><template #leading><IconPlus class="size-3.5" /></template>New design</AppButton>
          </div>
          <CloudWorkspaceView
            v-model:view="view"
            :heading="args.title"
            :can-create="Boolean(args.role)"
            :subtitle="args.subtitle"
            :role="args.role"
            :documents="args.documents"
            :state="args.state"
            :usage="args.usage"
            @open="args.onOpen"
          />
        </HomeLayout>
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const Workspace: Story = {}

export const NeedsAttention: Story = {
  args: { documents: previewDocuments }
}

export const Offline: Story = {
  args: {
    state: 'offline',
    documents: synced
      .slice(0, 4)
      .map((document) =>
        document.id === '2' ? { ...document, sync: 'offline' as const } : document
      )
  }
}

export const Loading: Story = {
  args: { state: 'loading', documents: [] }
}

export const EmptyWorkspace: Story = {
  args: {
    active: { kind: 'workspace', id: 'personal' },
    title: 'Personal',
    subtitle: undefined,
    role: 'Owner',
    documents: [],
    usage: { usedBytes: 0, totalBytes: 10 * 1024 ** 3 }
  }
}

export const SharedWithYou: Story = {
  args: {
    active: { kind: 'shared', id: 'shared' },
    title: 'Shared with you',
    subtitle: 'Files people invited you to',
    role: null,
    usage: null,
    documents: synced.slice(2, 5).map((document) => ({
      ...document,
      editedBy: `Shared by ${document.editedBy === 'You' ? 'Chloe' : document.editedBy}`
    }))
  }
}

export const SignedOut: Story = {
  args: {
    account: null,
    active: { kind: 'storage', id: 'storage' },
    title: 'Studio bucket',
    subtitle: 'Cloudflare R2 · studio-designs',
    role: null,
    usage: null,
    documents: synced
      .slice(0, 4)
      .map((document) => ({ ...document, shared: false, editedBy: undefined }))
  }
}

export const Phone: Story = {
  args: { realActions: true },
  parameters: { viewport: { defaultViewport: 'mobile1' } }
}

export const PhoneSharedWithYou: Story = {
  args: { ...SharedWithYou.args, realActions: true }
}
