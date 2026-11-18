<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { ToastClose, ToastDescription, ToastRoot } from 'reka-ui'
import { computed } from 'vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'

import AppProgress from './AppProgress.vue'
import SeverityIcon from './SeverityIcon.vue'
import { toast as toastTheme, toastProgressState, type ToastProps } from './toast'

const {
  message,
  variant = 'default',
  count = 1,
  progress = null,
  progressLabel,
  actionLabel,
  duration,
  copyable = false,
  copyLabel = '',
  copiedLabel = '',
  closeLabel = '',
  ui
} = defineProps<ToastProps>()

const emit = defineEmits<{ close: []; action: [] }>()

const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const state = computed(() => toastProgressState(progress))
const styles = computed(() => {
  const theme = toastTheme({ trailing: Boolean(actionLabel) || copyable, progress: state.value })
  return {
    root: theme.root({ class: ui?.root }),
    icon: theme.icon({ class: ui?.icon }),
    content: theme.content({ class: ui?.content }),
    message: theme.message({ class: ui?.message }),
    count: theme.count({ class: ui?.count }),
    progress: theme.progress({ class: ui?.progress }),
    action: theme.action({ class: ui?.action }),
    controls: theme.controls({ class: ui?.controls })
  }
})
</script>

<template>
  <!-- Reka does not cancel an existing dismissal timer when duration becomes 0.
       Remount when switching lifetime policy so resumed work cannot expire. -->
  <ToastRoot
    :key="duration === 0 ? 'persistent' : 'timed'"
    data-slot="toast"
    :duration="duration"
    :class="styles.root"
    :data-tone="variant"
    :data-progress="state"
    @update:open="
      (open) => {
        if (!open) emit('close')
      }
    "
  >
    <!-- A plain notice needs no icon; work in progress and problems do. -->
    <icon-lucide-loader-2 v-if="state !== 'none'" :class="styles.icon" aria-hidden="true" />
    <SeverityIcon v-else-if="variant !== 'default'" :severity="variant" :class="styles.icon" />
    <div :class="styles.content" data-slot="toast-content">
      <ToastDescription :class="styles.message">
        {{ message }}<span v-if="count > 1" :class="styles.count">×{{ count }}</span>
      </ToastDescription>
      <AppProgress
        v-if="progress"
        :amount="progress"
        :label="progressLabel"
        :aria-label="progressLabel ?? message"
        :class="styles.progress"
      />
      <slot />
    </div>
    <AppButton
      v-if="actionLabel"
      color="primary"
      variant="soft"
      :class="styles.action"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </AppButton>
    <div v-if="copyable" :class="styles.controls">
      <IconButton size="sm" :label="copied ? copiedLabel : copyLabel" @click="copy(message)">
        <icon-lucide-check v-if="copied" class="size-3.5" aria-hidden="true" />
        <icon-lucide-copy v-else class="size-3.5" aria-hidden="true" />
      </IconButton>
      <ToastClose as-child>
        <IconButton size="sm" :label="closeLabel">
          <icon-lucide-x class="size-3.5" aria-hidden="true" />
        </IconButton>
      </ToastClose>
    </div>
  </ToastRoot>
</template>
