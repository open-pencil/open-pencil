<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table'
import { computed, h, ref } from 'vue'
import IconKeyRound from '~icons/lucide/key-round'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalRows, type PortalTableFeatures } from '@/app/cloud-portal/list'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppConfirmationDialog from '@/components/ui/dialog/AppConfirmationDialog.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { useHeldContent } from '@/components/ui/overlay/held'
import AppDataTable from '@/components/ui/table/AppDataTable.vue'

import PortalTextCell from '../table/PortalTextCell.vue'
import type { PortalAccessToken } from '../types'

/**
 * The person's personal access tokens: each by its name and first characters, when it was made,
 * last used, and expires, with revoking asked once more. Making one is `create`'s dialog.
 */
const {
  tokens,
  busy = false,
  loading = false
} = defineProps<{
  tokens: PortalAccessToken[]
  busy?: boolean
  /** `first` before anything has loaded, `refresh` while it loads again. */
  loading?: 'first' | 'refresh' | false
}>()
const emit = defineEmits<{ create: []; revoke: [id: string] }>()

const messages = useCloudPortalMessages()
/** How a token is sent, shown as code inside the translated sentence where it falls. */
const ACCESS_TOKEN_HEADER = 'Authorization: Bearer <token>'
const HEADER_PLACEHOLDER = '{header}'
const intro = computed(() => messages.value.accessTokensIntro.split(/(\{header\})/))
const revoking = ref<PortalAccessToken | null>(null)
const revokingShown = useHeldContent(revoking)

const column = createColumnHelper<PortalTableFeatures, PortalAccessToken>()
const table = usePortalRows(() => tokens, {
  rowId: (token) => token.id,
  columns: column.columns([
    column.display({
      id: 'name',
      header: () => messages.value.name,
      cell: ({ row: { original: token } }) =>
        h(PortalTextCell, {
          icon: IconKeyRound,
          text: token.name,
          strong: true,
          detail: token.start ? `${token.start}…` : null
        })
    }),
    column.accessor('created', {
      header: () => messages.value.columnCreated,
      meta: { class: 'hidden w-32 whitespace-nowrap text-muted @2xl/table:table-cell' }
    }),
    column.display({
      id: 'lastUsed',
      header: () => messages.value.columnLastUsed,
      meta: { class: 'hidden w-32 whitespace-nowrap text-muted @xl/table:table-cell' },
      cell: ({ row: { original: token } }) => token.lastUsed ?? messages.value.accessTokenNeverUsed
    }),
    column.display({
      id: 'expires',
      header: () => messages.value.columnExpires,
      meta: { class: 'w-32 whitespace-nowrap text-muted' },
      cell: ({ row: { original: token } }) =>
        token.expired
          ? h('span', { class: 'text-warning' }, messages.value.accessTokenExpired)
          : token.expires
    }),
    column.display({
      id: 'actions',
      header: () => messages.value.columnActions,
      meta: { class: 'w-px text-right', actions: true },
      cell: ({ row: { original: token } }) =>
        h(
          AppButton,
          {
            size: 'sm',
            variant: 'ghost',
            disabled: busy,
            onClick: () => {
              revoking.value = token
            }
          },
          () => messages.value.revokeAccessToken
        )
    })
  ])
})

const heading = computed(() =>
  revokingShown.value
    ? messages.value.revokeAccessTokenHeading({ name: revokingShown.value.name })
    : ''
)

function confirm() {
  const token = revoking.value
  revoking.value = null
  if (token) emit('revoke', token.id)
}
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6">
    <SettingsSection>
      <template #title>{{ messages.accessTokens }}</template>
      <template #description>
        <template v-for="(part, index) in intro" :key="index">
          <code v-if="part === HEADER_PLACEHOLDER" class="font-mono text-surface">{{
            ACCESS_TOKEN_HEADER
          }}</code>
          <template v-else>{{ part }}</template>
        </template>
      </template>
      <template #actions>
        <AppButton size="sm" variant="outline" :disabled="busy" @click="emit('create')">
          <template #leading><icon-lucide-plus class="size-3.5" /></template>
          {{ messages.newAccessToken }}
        </AppButton>
      </template>
      <AppDataTable
        :table="table"
        :label="messages.accessTokens"
        :loading="loading"
        :loading-label="messages.loading"
      >
        <template #empty>
          <AppPlaceholder :label="messages.noAccessTokens">
            <template #icon><icon-lucide-key-round class="size-5" /></template>
          </AppPlaceholder>
        </template>
      </AppDataTable>
    </SettingsSection>

    <AppConfirmationDialog
      :open="revoking !== null"
      tone="danger"
      :heading="heading"
      :description="messages.revokeAccessTokenDescription"
      :confirm-label="messages.revokeAccessToken"
      @update:open="(open) => !open && (revoking = null)"
      @confirm="confirm"
    />
  </div>
</template>
