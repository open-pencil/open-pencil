<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle
} from 'reka-ui'

import { useI18n } from '@inkly/vue'

import { useAuthStore } from '@/app/auth/store'
import { toast, initials } from '@/app/shell/ui'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { useDialogUI } from '@/components/ui/dialog'

const { account: accountT } = useI18n()

useHead({ title: () => accountT.value.headTitle })

const auth = useAuthStore()
const router = useRouter()
void auth.init()

const displayName = computed(
  () => auth.user?.name?.trim() || auth.user?.email || accountT.value.defaultDisplayName
)
const avatarInitials = computed(() => initials(displayName.value))
const avatarAltText = computed(() =>
  accountT.value.avatarAlt({ name: displayName.value })
)
const logoutDialogOpen = ref(false)
const dialogCls = useDialogUI({
  content: 'w-[min(28rem,calc(100vw-2rem))] rounded-2xl p-5 shadow-2xl'
})

async function startLogin() {
  try {
    await auth.signInWithGoogle()
  } catch (error) {
    const message = error instanceof Error ? error.message : accountT.value.toastLoginFail
    toast.error(message)
  }
}

async function signOut() {
  try {
    await auth.signOut()
    toast.info(accountT.value.toastSignedOut)
    await router.push('/boards')
  } catch (error) {
    const message = error instanceof Error ? error.message : accountT.value.toastLogoutFail
    toast.error(message)
  }
}

function requestSignOut() {
  logoutDialogOpen.value = true
}

async function confirmSignOut() {
  logoutDialogOpen.value = false
  await signOut()
}
</script>

<template>
  <main
    data-test-id="account-view"
    class="min-h-screen bg-[radial-gradient(circle_at_top,rgba(89,140,255,0.18),transparent_35%),linear-gradient(180deg,var(--color-canvas),#0d1017)] px-6 py-10"
  >
    <div class="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section
        class="flex flex-col gap-3 rounded-[28px] border border-white/8 bg-panel/80 p-6 shadow-2xl backdrop-blur-xl md:flex-row md:items-start md:justify-between"
      >
        <div>
          <p class="text-[11px] font-medium uppercase tracking-[0.24em] text-accent">
            {{ accountT.eyebrow }}
          </p>
          <h1 class="mt-2 text-3xl font-semibold text-surface">{{ accountT.heading }}</h1>
          <p class="mt-2 max-w-2xl text-sm text-muted">
            {{ accountT.subtitle }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <RouterLink
            to="/"
            data-test-id="account-home-link"
            class="inline-flex items-center gap-2 rounded-xl border border-border bg-canvas/60 px-3 py-2 text-sm text-surface transition-colors hover:bg-hover"
          >
            <icon-lucide-home class="size-4" />
            <span>トップ</span>
          </RouterLink>
          <LocaleSwitcher test-id="account-locale-switcher" />
        </div>
      </section>

      <section
        v-if="!auth.initialized || auth.loading"
        class="rounded-[24px] border border-border bg-panel/70 p-6 text-sm text-muted"
      >
        {{ accountT.loading }}
      </section>

      <section
        v-else-if="!auth.isAuthenticated"
        class="rounded-[24px] border border-white/8 bg-panel/80 p-6 shadow-xl"
      >
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="space-y-2">
            <h2 class="text-xl font-semibold text-surface">{{ accountT.signInHeading }}</h2>
            <p class="max-w-xl text-sm text-muted">
              {{ accountT.signInDescription }}
            </p>
          </div>

          <button
            type="button"
            data-test-id="account-login-button"
            class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-canvas transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="auth.loginPending"
            @click="startLogin"
          >
            <icon-lucide-log-in class="size-4" />
            {{ auth.loginPending ? accountT.signInPending : accountT.signInButton }}
          </button>
        </div>
      </section>

      <section
        v-else
        data-test-id="account-profile"
        class="rounded-[24px] border border-white/8 bg-panel/80 p-6 shadow-xl"
      >
        <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-4">
            <img
              v-if="auth.user?.image"
              :src="auth.user.image"
              :alt="avatarAltText"
              data-test-id="account-avatar-image"
              class="size-16 rounded-full border border-white/10 object-cover"
            />
            <div
              v-else
              data-test-id="account-avatar-fallback"
              class="flex size-16 items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(135deg,rgba(103,149,255,0.85),rgba(78,95,172,0.85))] text-lg font-semibold text-white"
            >
              {{ avatarInitials }}
            </div>

            <div class="space-y-1">
              <p data-test-id="account-name" class="text-lg font-semibold text-surface">
                {{ displayName }}
              </p>
              <p data-test-id="account-email" class="text-sm text-muted">
                {{ auth.user?.email }}
              </p>
              <p v-if="auth.migrating" class="text-xs text-accent">{{ accountT.migrating }}</p>
            </div>
          </div>

          <button
            type="button"
            data-test-id="account-logout-button"
            class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="auth.logoutPending"
            @click="requestSignOut"
          >
            <icon-lucide-log-out class="size-4" />
            {{ auth.logoutPending ? accountT.logoutPending : accountT.logoutButton }}
          </button>
        </div>
      </section>
    </div>

    <AlertDialogRoot :open="logoutDialogOpen">
      <AlertDialogPortal>
        <AlertDialogOverlay :class="dialogCls.overlay" @click="logoutDialogOpen = false" />
        <AlertDialogContent
          data-test-id="account-logout-dialog"
          :class="dialogCls.content"
          @escape-key-down="logoutDialogOpen = false"
        >
          <AlertDialogTitle :class="dialogCls.title">{{ accountT.logoutDialogTitle }}</AlertDialogTitle>
          <AlertDialogDescription :class="dialogCls.description">
            {{ accountT.logoutDialogDescription }}
          </AlertDialogDescription>

          <div class="mt-4 rounded-xl border border-border bg-canvas/70 p-3 text-xs text-muted">
            {{ accountT.logoutDialogHint }}
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <AlertDialogCancel
              data-test-id="account-logout-cancel"
              class="rounded-md border border-border bg-canvas px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface"
              @click="logoutDialogOpen = false"
            >
              {{ accountT.logoutDialogCancel }}
            </AlertDialogCancel>
            <AlertDialogAction
              data-test-id="account-logout-confirm"
              class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90"
              @click="confirmSignOut"
            >
              {{ accountT.logoutDialogConfirm }}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialogRoot>
  </main>
</template>
