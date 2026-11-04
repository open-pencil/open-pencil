<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import type { CloudSyncState } from '@/components/home/cloud/types'
import AppButton from '@/components/ui/button/AppButton.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import Tip from '@/components/ui/overlay/Tip.vue'
import cloudStatusTheme from '@/theme/cloud/status'

const cloudStatus = tv(cloudStatusTheme)

/**
 * Where the open Cloud document stands, beside its name: saved, saving, waiting on this device,
 * or needing a choice. Opening it says where the file lives and offers what fits the state.
 */
const {
  state,
  workspace,
  host,
  savedAgo = null,
  viewOnly = false,
  notLive = false,
  canRejoin = false
} = defineProps<{
  state: CloudSyncState
  workspace: string
  host: string
  savedAgo?: string | null
  viewOnly?: boolean
  /** The server ended this tab's live session; a conflict or failed save still shows first. */
  notLive?: boolean
  /** Whether rejoining loses nothing, which holds once the tab's changes are saved. */
  canRejoin?: boolean
}>()

const emit = defineEmits<{
  share: []
  openWorkspace: []
  resolve: []
  retry: []
  rejoin: []
}>()

const ui = cloudStatus()
const popoverOpen = ref(false)
/** Every action leads somewhere else, so the popover closes first. */
function act(action: 'share' | 'openWorkspace' | 'resolve' | 'retry' | 'rejoin') {
  popoverOpen.value = false
  if (action === 'share') emit('share')
  else if (action === 'openWorkspace') emit('openWorkspace')
  else if (action === 'resolve') emit('resolve')
  else if (action === 'rejoin') emit('rejoin')
  else emit('retry')
}
const showsNotLive = computed(() => notLive && state !== 'conflict' && state !== 'error')
const syncAttribute = computed(() => {
  if (showsNotLive.value) return 'not-live'
  return viewOnly ? 'view' : state
})
const popover = usePopoverUI({ content: 'w-72 p-3' })
const t = useCloudMessages()
const summary = computed(() => {
  const m = t.value
  if (showsNotLive.value) return { label: m.statusNotLive, detail: m.statusNotLiveDetail }
  if (viewOnly) return { label: m.viewOnly, detail: m.statusViewOnlyDetail }
  const summaries: Record<CloudSyncState, { label: string; detail: string }> = {
    synced: {
      label: m.statusSavedTo({ workspace }),
      detail: savedAgo ? m.statusSavedAgo({ time: savedAgo }) : m.statusUpToDate
    },
    uploading: { label: m.statusSaving, detail: m.statusUploadingTo({ workspace }) },
    pending: { label: m.statusSavedOnDevice, detail: m.statusUploadsSoon },
    offline: { label: m.statusSavedOnDevice, detail: m.statusOfflineDetail },
    conflict: { label: m.statusConflict, detail: m.statusConflictDetail },
    error: { label: m.saveFailedHeading, detail: m.statusErrorDetail }
  }
  return summaries[state]
})
</script>

<template>
  <PopoverRoot v-model:open="popoverOpen">
    <Tip :label="summary.label" as-child>
      <PopoverTrigger
        :class="ui.trigger()"
        :data-state-sync="syncAttribute"
        :aria-label="summary.label"
      >
        <icon-lucide-unplug v-if="showsNotLive" class="size-3.5" />
        <icon-lucide-eye v-else-if="viewOnly" class="size-3.5" />
        <icon-lucide-cloud-check v-else-if="state === 'synced'" class="size-3.5" />
        <icon-lucide-loader-circle
          v-else-if="state === 'uploading'"
          class="size-3.5 animate-spin motion-reduce:animate-none"
        />
        <icon-lucide-cloud-off v-else-if="state === 'offline'" class="size-3.5" />
        <icon-lucide-cloud-upload v-else-if="state === 'pending'" class="size-3.5" />
        <icon-lucide-git-compare-arrows v-else-if="state === 'conflict'" class="size-3.5" />
        <icon-lucide-circle-alert v-else class="size-3.5" />
        <span v-if="showsNotLive" :class="ui.triggerLabel()">{{ t.statusNotLive }}</span>
        <span v-else-if="viewOnly || state === 'conflict'" :class="ui.triggerLabel()">
          {{ viewOnly ? t.viewOnly : t.statusResolve }}
        </span>
      </PopoverTrigger>
    </Tip>
    <PopoverPortal>
      <PopoverContent side="bottom" align="start" :side-offset="6" :class="popover.content">
        <div :class="ui.header()">
          <span :class="ui.headerIcon()" :data-state-sync="syncAttribute">
            <icon-lucide-unplug v-if="showsNotLive" class="size-4" />
            <icon-lucide-eye v-else-if="viewOnly" class="size-4" />
            <icon-lucide-git-compare-arrows v-else-if="state === 'conflict'" class="size-4" />
            <icon-lucide-circle-alert v-else-if="state === 'error'" class="size-4" />
            <icon-lucide-cloud-off v-else-if="state === 'offline'" class="size-4" />
            <icon-lucide-cloud class="size-4" v-else />
          </span>
          <div class="min-w-0">
            <p :class="ui.title()">{{ summary.label }}</p>
            <p :class="ui.detail()">{{ summary.detail }}</p>
          </div>
        </div>
        <dl :class="ui.facts()">
          <div :class="ui.fact()">
            <dt>{{ t.workspace }}</dt>
            <dd>{{ workspace }}</dd>
          </div>
          <div :class="ui.fact()">
            <dt>{{ t.server }}</dt>
            <dd>{{ host }}</dd>
          </div>
        </dl>
        <div :class="ui.actions()">
          <AppButton
            v-if="state === 'conflict' && !viewOnly"
            size="sm"
            color="primary"
            variant="solid"
            @click="act('resolve')"
          >
            {{ t.statusChooseVersion }}
          </AppButton>
          <AppButton
            v-else-if="showsNotLive && canRejoin"
            size="sm"
            color="primary"
            variant="solid"
            @click="act('rejoin')"
          >
            {{ t.statusRejoin }}
          </AppButton>
          <AppButton
            v-else-if="state === 'error' && !viewOnly"
            size="sm"
            variant="outline"
            @click="act('retry')"
          >
            {{ t.tryAgain }}
          </AppButton>
          <AppButton size="sm" variant="outline" @click="act('share')">
            <template #leading><icon-lucide-user-plus class="size-3.5" /></template>
            {{ t.share }}
          </AppButton>
          <AppButton size="sm" variant="ghost" @click="act('openWorkspace')">{{
            t.statusOpenWorkspace
          }}</AppButton>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
