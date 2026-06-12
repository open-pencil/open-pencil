<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useHead } from '@unhead/vue'

import { useAuthStore } from '@/app/auth/store'
import { redeemInvitation, verifyInvitation } from '@/app/api/client'
import { useI18n } from '@inkly/vue'

const { inviteAuth: t } = useI18n()

useHead({ title: () => t.value.headTitle })

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// verify 状態
type VerifyStatus = 'verifying' | 'invalid' | 'expired' | 'ready' | 'authed'
const status = ref<VerifyStatus>('verifying')
const invitationBoardId = ref('')

// form 状態
const mode = ref<'signUp' | 'signIn'>('signUp')
const name = ref('')
const email = ref('')
const password = ref('')
const submitting = ref(false)
const formError = ref<string | null>(null)

const token = computed(() =>
  typeof route.params.token === 'string' ? route.params.token : ''
)

const boardPath = computed(() =>
  invitationBoardId.value ? `/board/${invitationBoardId.value}` : null
)

const headline = computed(() => {
  switch (status.value) {
    case 'verifying':
      return t.value.headlineVerifying
    case 'invalid':
      return t.value.headlineInvalid
    case 'expired':
      return t.value.headlineExpired
    case 'authed':
      return t.value.headlineAuthed
    case 'ready':
      return mode.value === 'signUp' ? t.value.headlineSignUp : t.value.headlineSignIn
    default:
      return ''
  }
})

onMounted(async () => {
  if (!token.value) {
    status.value = 'invalid'
    return
  }

  try {
    const result = await verifyInvitation(token.value)
    if (!result.valid || !result.invitation) {
      status.value = result.reason === 'expired' ? 'expired' : 'invalid'
      return
    }

    invitationBoardId.value = result.invitation.boardId

    if (!auth.initialized) {
      await auth.init()
    }

    if (auth.isAuthenticated) {
      status.value = 'authed'
      // 既存 user は自動で board へ
      void router.replace(`/board/${result.invitation.boardId}`)
      return
    }

    status.value = 'ready'
  } catch {
    status.value = 'invalid'
  }
})

async function submitForm() {
  if (submitting.value) return
  formError.value = null
  if (password.value.length < 8) {
    formError.value = t.value.errorPasswordTooShort
    return
  }
  if (mode.value === 'signUp' && !name.value.trim()) {
    formError.value = t.value.errorNameRequired
    return
  }
  submitting.value = true
  try {
    const response = await redeemInvitation({
      token: token.value,
      email: email.value.trim(),
      password: password.value,
      name: mode.value === 'signUp' ? name.value.trim() : undefined,
      mode: mode.value
    })

    if ('error' in response) {
      formError.value = t.value.errorMap[response.error.code] ?? response.error.message
      return
    }

    // session cookie は Set-Cookie で焼かれてるので auth.init で取り直す
    await auth.init()
    if (boardPath.value) {
      void router.replace(boardPath.value)
    }
  } catch (error) {
    formError.value = error instanceof Error ? error.message : t.value.errorUnknown
  } finally {
    submitting.value = false
  }
}

function switchMode(next: 'signUp' | 'signIn') {
  mode.value = next
  formError.value = null
}
</script>

<template>
  <main
    data-test-id="invite-redirect-view"
    class="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(91,171,255,0.18),transparent_30%),linear-gradient(180deg,var(--color-canvas),#0b1018)] px-6"
  >
    <div class="w-full max-w-md rounded-[28px] border border-white/10 bg-panel/85 p-8 shadow-2xl backdrop-blur-xl">
      <p class="text-center text-sm uppercase tracking-[0.18em] text-accent">{{ t.eyebrow }}</p>
      <h1 class="mt-3 text-center text-2xl font-semibold text-surface">
        {{ headline }}
      </h1>

      <template v-if="status === 'verifying' || status === 'authed'">
        <p class="mt-3 text-center text-sm text-muted">{{ t.verifyingHint }}</p>
      </template>

      <template v-else-if="status === 'invalid' || status === 'expired'">
        <p class="mt-3 text-center text-sm text-muted">{{ t.invalidHint }}</p>
        <RouterLink
          to="/"
          data-test-id="invite-invalid-back-link"
          class="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          {{ t.backToTop }}
        </RouterLink>
      </template>

      <template v-else-if="status === 'ready'">
        <div class="mt-6 flex gap-2 rounded-xl border border-white/10 bg-canvas/30 p-1">
          <button
            type="button"
            data-test-id="invite-mode-signup"
            :class="[
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              mode === 'signUp' ? 'bg-accent text-white' : 'text-muted hover:text-surface'
            ]"
            @click="switchMode('signUp')"
          >
            {{ t.modeSignUp }}
          </button>
          <button
            type="button"
            data-test-id="invite-mode-signin"
            :class="[
              'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              mode === 'signIn' ? 'bg-accent text-white' : 'text-muted hover:text-surface'
            ]"
            @click="switchMode('signIn')"
          >
            {{ t.modeSignIn }}
          </button>
        </div>

        <form class="mt-5 flex flex-col gap-3" @submit.prevent="submitForm">
          <label v-if="mode === 'signUp'" class="flex flex-col gap-1.5 text-sm">
            <span class="text-muted">{{ t.nameLabel }}</span>
            <input
              v-model="name"
              type="text"
              autocomplete="name"
              required
              data-test-id="invite-name-input"
              :placeholder="t.namePlaceholder"
              class="rounded-lg border border-border bg-canvas/60 px-3 py-2 text-surface placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span class="text-muted">{{ t.emailLabel }}</span>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              required
              data-test-id="invite-email-input"
              :placeholder="t.emailPlaceholder"
              class="rounded-lg border border-border bg-canvas/60 px-3 py-2 text-surface placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <label class="flex flex-col gap-1.5 text-sm">
            <span class="text-muted">{{ t.passwordLabel }}</span>
            <input
              v-model="password"
              type="password"
              :autocomplete="mode === 'signUp' ? 'new-password' : 'current-password'"
              required
              minlength="8"
              data-test-id="invite-password-input"
              :placeholder="t.passwordPlaceholder"
              class="rounded-lg border border-border bg-canvas/60 px-3 py-2 text-surface placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </label>
          <p
            v-if="formError"
            data-test-id="invite-form-error"
            class="text-sm text-red-300"
          >
            {{ formError }}
          </p>
          <button
            type="submit"
            :disabled="submitting"
            data-test-id="invite-submit-button"
            class="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ submitting ? t.submitSubmitting : mode === 'signUp' ? t.submitSignUp : t.submitSignIn }}
          </button>
        </form>
      </template>
    </div>
  </main>
</template>
