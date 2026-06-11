<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { useAuthStore } from '@/app/auth/store'
import { verifyInvitation } from '@/app/api/client'

useHead({ title: 'Invitation' })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const invalidReason = ref('')

onMounted(async () => {
  const token = typeof route.params.token === 'string' ? route.params.token : ''
  if (!token) {
    invalidReason.value = '招待が無効です'
    loading.value = false
    return
  }

  try {
    const result = await verifyInvitation(token)
    if (!result.valid || !result.invitation) {
      invalidReason.value = '招待が無効です'
      loading.value = false
      return
    }

    const boardPath = `/board/${result.invitation.boardId}`

    // 招待リンクは認証必須。 未ログインなら LP に returnTo で送り、 ログイン後に
    // board へ遷移させる (router の beforeEach guard が /board/:id を保護対象として扱う)。
    if (!auth.initialized) {
      await auth.init()
    }
    if (!auth.isAuthenticated) {
      void router.replace({
        path: '/',
        query: { returnTo: boardPath, invite: token }
      })
      return
    }

    void router.replace(boardPath)
  } catch {
    invalidReason.value = '招待が無効です'
    loading.value = false
  }
})
</script>

<template>
  <main
    data-test-id="invite-redirect-view"
    class="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(91,171,255,0.18),transparent_30%),linear-gradient(180deg,var(--color-canvas),#0b1018)] px-6"
  >
    <div class="w-full max-w-md rounded-[28px] border border-white/10 bg-panel/85 p-8 text-center shadow-2xl backdrop-blur-xl">
      <template v-if="loading">
        <p class="text-sm uppercase tracking-[0.18em] text-accent">Invite</p>
        <h1 class="mt-3 text-2xl font-semibold text-surface">Verifying invitation…</h1>
        <p class="mt-3 text-sm text-muted">You will be redirected to the editor automatically.</p>
      </template>

      <template v-else>
        <p class="text-sm uppercase tracking-[0.18em] text-red-300">Invite</p>
        <h1 class="mt-3 text-2xl font-semibold text-surface">{{ invalidReason }}</h1>
        <p class="mt-3 text-sm text-muted">
          The token may be expired or revoked. Create a fresh invite from the board settings page.
        </p>
        <RouterLink
          to="/boards"
          data-test-id="invite-invalid-boards-link"
          class="mt-6 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Go to boards
        </RouterLink>
      </template>
    </div>
  </main>
</template>
