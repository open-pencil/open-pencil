<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'

import type { CloudSyncState } from '@/components/home/cloud/types'
import AppButton from '@/components/ui/button/AppButton.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import Tip from '@/components/ui/overlay/Tip.vue'
import { cloudStatus } from '@/theme/cloud/status'

/**
 * Where the open Cloud document stands, beside its name: saved, saving, waiting on this device,
 * or needing a choice. Opening it says where the file lives and offers what fits the state.
 */
const {
  state,
  workspace,
  host,
  savedAgo = null,
  viewOnly = false
} = defineProps<{
  state: CloudSyncState
  workspace: string
  host: string
  savedAgo?: string | null
  viewOnly?: boolean
}>()

const emit = defineEmits<{
  share: []
  openWorkspace: []
  resolve: []
  retry: []
}>()

const ui = cloudStatus()
const popover = usePopoverUI({ content: 'w-72 p-3' })
const summary = computed(() => {
  if (viewOnly)
    return { label: 'View only', detail: 'You can look around and follow others, not edit.' }
  const summaries: Record<CloudSyncState, { label: string; detail: string }> = {
    synced: {
      label: `Saved to ${workspace}`,
      detail: savedAgo ? `Saved ${savedAgo}` : 'Up to date'
    },
    uploading: { label: 'Saving…', detail: `Uploading to ${workspace}` },
    pending: { label: 'Saved on this device', detail: 'Uploads in a moment' },
    offline: {
      label: 'Saved on this device',
      detail: 'You’re offline. Changes upload when you reconnect.'
    },
    conflict: {
      label: 'Changed in two places',
      detail: 'Someone saved a newer version while you edited. Choose which to keep.'
    },
    error: { label: 'Couldn’t save to Cloud', detail: 'Your changes are safe on this device.' }
  }
  return summaries[state]
})
</script>

<template>
  <PopoverRoot>
    <Tip :label="summary.label" as-child>
      <PopoverTrigger
        :class="ui.trigger()"
        :data-state-sync="viewOnly ? 'view' : state"
        :aria-label="summary.label"
      >
        <icon-lucide-eye v-if="viewOnly" class="size-3.5" />
        <icon-lucide-cloud-check v-else-if="state === 'synced'" class="size-3.5" />
        <icon-lucide-loader-circle
          v-else-if="state === 'uploading'"
          class="size-3.5 animate-spin motion-reduce:animate-none"
        />
        <icon-lucide-cloud-off v-else-if="state === 'offline'" class="size-3.5" />
        <icon-lucide-cloud-upload v-else-if="state === 'pending'" class="size-3.5" />
        <icon-lucide-git-compare-arrows v-else-if="state === 'conflict'" class="size-3.5" />
        <icon-lucide-circle-alert v-else class="size-3.5" />
        <span v-if="viewOnly || state === 'conflict'" :class="ui.triggerLabel()">
          {{ viewOnly ? 'View only' : 'Resolve' }}
        </span>
      </PopoverTrigger>
    </Tip>
    <PopoverPortal>
      <PopoverContent side="bottom" align="start" :side-offset="6" :class="popover.content">
        <div :class="ui.header()">
          <span :class="ui.headerIcon()" :data-state-sync="viewOnly ? 'view' : state">
            <icon-lucide-eye v-if="viewOnly" class="size-4" />
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
            <dt>Workspace</dt>
            <dd>{{ workspace }}</dd>
          </div>
          <div :class="ui.fact()">
            <dt>Server</dt>
            <dd>{{ host }}</dd>
          </div>
        </dl>
        <div :class="ui.actions()">
          <AppButton
            v-if="state === 'conflict' && !viewOnly"
            size="sm"
            color="primary"
            variant="solid"
            @click="emit('resolve')"
          >
            Choose a version
          </AppButton>
          <AppButton
            v-else-if="state === 'error' && !viewOnly"
            size="sm"
            variant="outline"
            @click="emit('retry')"
          >
            Try again
          </AppButton>
          <AppButton size="sm" variant="outline" @click="emit('share')">
            <template #leading><icon-lucide-user-plus class="size-3.5" /></template>
            Share
          </AppButton>
          <AppButton size="sm" variant="ghost" @click="emit('openWorkspace')"
            >Open workspace</AppButton
          >
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
