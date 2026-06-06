<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import { useI18n } from '@inkly/vue'

import { useNotificationsStore } from '@/app/notifications/store'
import {
  formatNotificationTime,
  getNotificationBody,
  getNotificationTarget,
  getNotificationTitle,
  isNotificationUnread
} from '@/app/notifications/format'
import { toast } from '@/app/shell/ui'
import { usePopoverUI } from '@/components/ui/popover'

const {
  notifications: notificationsT,
  notificationsFormat: notificationsFormatT,
  notificationBell: notificationBellT
} = useI18n()

const router = useRouter()
const notifications = useNotificationsStore()
const open = ref(false)
const cls = usePopoverUI({ content: 'z-50 w-[min(24rem,calc(100vw-2rem))] p-2 shadow-2xl' })

const badgeLabel = computed(() => (notifications.unreadCount > 99 ? '99+' : String(notifications.unreadCount)))

async function openNotification(notificationId: string) {
  const notification = notifications.items.find((candidate) => candidate.id === notificationId)
  if (!notification) return

  try {
    if (notification.readAt === null) {
      await notifications.markRead(notification.id)
    }

    open.value = false
    await router.push(getNotificationTarget(notification))
  } catch (error) {
    const message = error instanceof Error ? error.message : notificationsT.value.toastOpenFail
    toast.error(message)
  }
}

function openAllNotifications() {
  open.value = false
  void router.push('/notifications')
}

onMounted(() => {
  void notifications.mount()
})

onUnmounted(() => {
  notifications.unmount()
})
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        data-test-id="notification-bell-trigger"
        class="relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-canvas/55 text-surface transition-colors hover:bg-hover"
        :aria-label="notificationBellT.triggerAriaLabel"
      >
        <icon-lucide-bell class="size-4" :aria-hidden="true" />
        <span
          v-if="notifications.unreadCount > 0"
          data-test-id="notification-bell-badge"
          class="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white"
        >
          {{ badgeLabel }}
        </span>
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        data-test-id="notification-bell-popover"
        :class="cls.content"
        :side-offset="8"
        side="bottom"
        align="end"
      >
        <div class="flex items-center justify-between px-2 pb-2 pt-1">
          <div>
            <p class="text-xs font-semibold text-surface">{{ notificationBellT.popoverHeading }}</p>
            <p class="text-[11px] text-muted">{{ notificationBellT.popoverSubtitle }}</p>
          </div>
          <button
            type="button"
            data-test-id="notification-bell-view-all"
            class="cursor-pointer rounded-md px-2 py-1 text-[11px] text-accent transition-colors hover:bg-hover"
            @click="openAllNotifications"
          >
            {{ notificationBellT.viewAll }}
          </button>
        </div>

        <div
          v-if="notifications.loading && notifications.items.length === 0"
          class="rounded-xl px-3 py-4 text-sm text-muted"
        >
          {{ notificationBellT.loading }}
        </div>

        <div
          v-else-if="notifications.latest.length === 0"
          data-test-id="notification-bell-empty"
          class="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted"
        >
          {{ notificationBellT.empty }}
        </div>

        <ul v-else class="space-y-2">
          <li v-for="notification in notifications.latest" :key="notification.id">
            <button
              type="button"
              data-test-id="notification-popover-item"
              class="flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors hover:bg-hover"
              :class="
                isNotificationUnread(notification)
                  ? 'border-accent/35 bg-accent/8'
                  : 'border-border bg-canvas/45'
              "
              @click="openNotification(notification.id)"
            >
              <span
                class="mt-1 size-2.5 shrink-0 rounded-full"
                :class="isNotificationUnread(notification) ? 'bg-accent' : 'bg-border'"
              />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-surface">
                  {{ getNotificationTitle(notification, notificationsFormatT) }}
                </span>
                <span class="mt-1 block text-xs text-muted">
                  {{ getNotificationBody(notification, notificationsFormatT) }}
                </span>
                <span class="mt-2 block text-[11px] text-muted/80">
                  {{ formatNotificationTime(notification) }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
