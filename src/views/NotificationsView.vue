<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { useI18n } from '@inkly/vue'

import { useAuthStore } from '@/app/auth/store'
import {
  formatNotificationTime,
  getNotificationBody,
  getNotificationTarget,
  getNotificationTitle,
  isNotificationUnread
} from '@/app/notifications/format'
import { useNotificationsStore } from '@/app/notifications/store'
import { toast } from '@/app/shell/ui'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import LoginBanner from '@/components/LoginBanner.vue'

const { notifications: notificationsT, notificationsFormat: notificationsFormatT, common: commonT } = useI18n()

useHead({ title: () => notificationsT.value.headTitle })

const auth = useAuthStore()
const notifications = useNotificationsStore()
const router = useRouter()

const showLoginBanner = computed(() => auth.initialized && !auth.isAuthenticated)

async function startGoogleLogin() {
  try {
    await auth.signInWithGoogle(window.location.toString())
  } catch (error) {
    const message = error instanceof Error ? error.message : notificationsT.value.toastLoginFail
    toast.error(message)
  }
}

async function markRead(notificationId: string) {
  try {
    await notifications.markRead(notificationId)
  } catch (error) {
    const message = error instanceof Error ? error.message : notificationsT.value.toastMarkReadFail
    toast.error(message)
  }
}

async function markAllRead() {
  try {
    await notifications.markAllRead()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : notificationsT.value.toastMarkAllReadFail
    toast.error(message)
  }
}

async function removeNotification(notificationId: string) {
  try {
    await notifications.remove(notificationId)
  } catch (error) {
    const message = error instanceof Error ? error.message : notificationsT.value.toastDeleteFail
    toast.error(message)
  }
}

async function openNotification(notificationId: string) {
  const notification = notifications.items.find((candidate) => candidate.id === notificationId) ?? null
  if (!notification) return

  try {
    if (isNotificationUnread(notification)) {
      await notifications.markRead(notification.id)
    }

    await router.push(getNotificationTarget(notification))
  } catch (error) {
    const message = error instanceof Error ? error.message : notificationsT.value.toastOpenFail
    toast.error(message)
  }
}

onMounted(async () => {
  await auth.init()
  await notifications.mount()
})

onUnmounted(() => {
  notifications.unmount()
})
</script>

<template>
  <main
    data-test-id="notifications-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(103,149,255,0.15),transparent_28%),linear-gradient(180deg,var(--color-canvas),#0c1018)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section class="rounded-[28px] border border-white/8 bg-panel/85 p-6 shadow-2xl backdrop-blur-xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="space-y-2">
            <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-accent">{{ notificationsT.eyebrow }}</p>
            <h1 class="text-3xl font-semibold text-surface">{{ notificationsT.heading }}</h1>
            <p class="max-w-2xl text-sm text-muted">
              {{ notificationsT.subtitle }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <LocaleSwitcher test-id="notifications-locale-switcher" />
            <RouterLink
              to="/"
              data-test-id="notifications-home-link"
              class="inline-flex items-center gap-2 rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
            >
              <icon-lucide-home class="size-4" />
              <span>{{ commonT.home }}</span>
            </RouterLink>
            <RouterLink
              to="/boards"
              class="inline-flex items-center gap-2 rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
            >
              <icon-lucide-arrow-left class="size-4" />
              <span>{{ notificationsT.backToBoards }}</span>
            </RouterLink>
            <button
              v-if="auth.isAuthenticated && notifications.unreadCount > 0"
              type="button"
              data-test-id="notifications-read-all"
              class="cursor-pointer rounded-xl bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
              @click="markAllRead"
            >
              {{ notificationsT.markAllRead }}
            </button>
          </div>
        </div>

        <LoginBanner
          v-if="showLoginBanner"
          :loading="auth.loginPending"
          :migrating="auth.migrating"
          @login="startGoogleLogin"
        />
      </section>

      <section
        v-if="notifications.loading && notifications.items.length === 0"
        class="rounded-2xl border border-border bg-panel/70 p-6 text-sm text-muted"
      >
        {{ notificationsT.loading }}
      </section>

      <section
        v-else-if="auth.initialized && !auth.isAuthenticated"
        class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
      >
        <p class="text-lg font-medium text-surface">{{ notificationsT.loginRequiredHeading }}</p>
        <p class="mt-2 text-sm text-muted">
          {{ notificationsT.loginRequiredHint }}
        </p>
      </section>

      <section
        v-else-if="notifications.items.length === 0"
        data-test-id="notifications-empty"
        class="rounded-[24px] border border-dashed border-border bg-panel/60 p-10 text-center"
      >
        <p class="text-lg font-medium text-surface">{{ notificationsT.emptyHeading }}</p>
        <p class="mt-2 text-sm text-muted">
          {{ notificationsT.emptyHint }}
        </p>
      </section>

      <section v-else class="space-y-3">
        <article
          v-for="notification in notifications.items"
          :key="notification.id"
          data-test-id="notification-item"
          class="rounded-[24px] border p-5 shadow-xl transition-colors"
          :class="
            isNotificationUnread(notification)
              ? 'border-accent/35 bg-[linear-gradient(135deg,rgba(84,125,255,0.16),rgba(16,20,30,0.92))]'
              : 'border-border bg-panel/75'
          "
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex items-center gap-2">
                <span
                  class="size-2.5 rounded-full"
                  :class="isNotificationUnread(notification) ? 'bg-accent' : 'bg-border'"
                />
                <span class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  {{ notification.type.replace('_', ' ') }}
                </span>
              </div>

              <div class="space-y-1">
                <p class="text-lg font-semibold text-surface">
                  {{ getNotificationTitle(notification, notificationsFormatT) }}
                </p>
                <p class="text-sm text-muted">
                  {{ getNotificationBody(notification, notificationsFormatT) }}
                </p>
              </div>

              <p class="text-[11px] text-muted/80">
                {{ formatNotificationTime(notification) }}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                data-test-id="notification-open-link"
                class="inline-flex items-center gap-2 rounded-md border border-border bg-canvas/55 px-3 py-1.5 text-xs text-surface transition-colors hover:bg-hover"
                @click="openNotification(notification.id)"
              >
                <icon-lucide-arrow-up-right class="size-3.5" />
                <span>{{ notificationsT.openLabel }}</span>
              </button>
              <button
                v-if="isNotificationUnread(notification)"
                type="button"
                data-test-id="notification-mark-read"
                class="cursor-pointer rounded-md border border-border bg-panel px-3 py-1.5 text-xs text-surface transition-colors hover:bg-hover"
                @click="markRead(notification.id)"
              >
                {{ notificationsT.markReadLabel }}
              </button>
              <button
                type="button"
                data-test-id="notification-delete"
                class="cursor-pointer rounded-md border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs text-red-100 transition-colors hover:bg-red-500/16"
                @click="removeNotification(notification.id)"
              >
                {{ notificationsT.deleteLabel }}
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  </main>
</template>
