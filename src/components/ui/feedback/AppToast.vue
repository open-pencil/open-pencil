<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { ToastClose, ToastDescription, ToastRoot } from 'reka-ui'
import { computed } from 'vue'

import Tip from '@/components/ui/overlay/Tip.vue'

import AppProgress from './AppProgress.vue'
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
  copyLabel,
  copiedLabel,
  closeLabel,
  ui
} = defineProps<ToastProps>()

const emit = defineEmits<{ close: []; action: [] }>()

const { copy, copied } = useClipboard({ copiedDuring: 1500 })
const state = computed(() => toastProgressState(progress))
const styles = computed(() => {
  const theme = toastTheme({ tone: variant, progress: state.value })
  return {
    root: theme.root({ class: ui?.root }),
    icon: theme.icon({ class: ui?.icon }),
    content: theme.content({ class: ui?.content }),
    message: theme.message({ class: ui?.message }),
    count: theme.count({ class: ui?.count }),
    progress: theme.progress({ class: ui?.progress }),
    action: theme.action({ class: ui?.action }),
    control: theme.control({ class: ui?.control })
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
    <icon-lucide-loader-2 v-if="state !== 'none'" :class="styles.icon" aria-hidden="true" />
    <icon-lucide-check v-else-if="variant === 'default'" :class="styles.icon" aria-hidden="true" />
    <icon-lucide-triangle-alert v-else :class="styles.icon" aria-hidden="true" />
    <div :class="styles.content" data-slot="toast-content">
      <ToastDescription :class="styles.message">
        {{ message }}<span v-if="count > 1" :class="styles.count">×{{ count }}</span>
      </ToastDescription>
      <AppProgress
        v-if="progress"
        :amount="progress"
        :label="progressLabel"
        :aria-label="progressLabel ?? message"
        tone="current"
        :class="styles.progress"
      />
      <slot />
    </div>
    <button v-if="actionLabel" type="button" :class="styles.action" @click="emit('action')">
      {{ actionLabel }}
    </button>
    <template v-if="copyable">
      <Tip :label="copied ? copiedLabel : copyLabel">
        <button
          type="button"
          data-slot="toast-copy"
          :class="styles.control"
          :aria-label="copied ? copiedLabel : copyLabel"
          @click="copy(message)"
        >
          <icon-lucide-check v-if="copied" class="size-3" aria-hidden="true" />
          <icon-lucide-copy v-else class="size-3" aria-hidden="true" />
        </button>
      </Tip>
      <ToastClose data-slot="toast-close" :class="styles.control" :aria-label="closeLabel">
        <icon-lucide-x class="size-3" aria-hidden="true" />
      </ToastClose>
    </template>
  </ToastRoot>
</template>
