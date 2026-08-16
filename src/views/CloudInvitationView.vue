<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { InvitationPreview } from '@open-pencil/cloud/contract'
import { createCloudAPIClient, discoverCloud, signInToCloud } from '@open-pencil/cloud/client'

import AppTextButton from '@/components/ui/AppTextButton.vue'

const route = useRoute()
const router = useRouter()
const invitation = ref<InvitationPreview | null>(null)
const error = ref('')
const loading = ref(true)
const accepting = ref(false)
const serverURL = ref('')
const token = ref('')
const invitationId = typeof route.params.invitationId === 'string' ? route.params.invitationId : ''

async function client() {
  const discovery = await discoverCloud(serverURL.value)
  return { discovery, client: createCloudAPIClient(discovery.apiURL) }
}

async function resumeContinuation() {
  const continuation = typeof route.query.continuation === 'string' ? route.query.continuation : ''
  if (!continuation || !serverURL.value) return false
  const cloud = await client()
  const restored = await cloud.client.consumeInvitationContinuation(continuation)
  token.value = restored.token
  invitation.value = await cloud.client.previewDocumentInvitation(restored.invitationId, {
    token: restored.token
  })
  await router.replace({
    name: 'cloud-invitation',
    params: { invitationId: restored.invitationId },
    query: { server: serverURL.value }
  })
  return true
}

async function load() {
  const server = typeof route.query.server === 'string' ? route.query.server : ''
  const secret = window.location.hash.slice(1)
  history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`)
  serverURL.value = server
  try {
    if (await resumeContinuation()) return
  } catch {
    error.value = 'This invitation is invalid or no longer available.'
    loading.value = false
    return
  }
  if (!invitationId || !server || !secret) {
    error.value = 'This invitation is invalid or no longer available.'
    loading.value = false
    return
  }
  token.value = secret
  try {
    const cloud = await client()
    invitation.value = await cloud.client.previewDocumentInvitation(invitationId, { token: secret })
  } catch {
    error.value = 'This invitation is invalid or no longer available.'
  } finally {
    loading.value = false
  }
}

async function accept() {
  accepting.value = true
  try {
    const cloud = await client()
    const session = await cloud.client.getSession()
    if (!session) {
      const provider = cloud.discovery.authentication.socialProviders[0]
      if (!provider) throw new Error('No sign-in provider is configured')
      const continuation = await cloud.client.createInvitationContinuation({
        invitationId,
        token: token.value
      })
      const callback = new URL(window.location.href)
      callback.hash = ''
      callback.searchParams.set('continuation', continuation.id)
      await signInToCloud(cloud.discovery, provider, callback.href)
      return
    }
    await cloud.client.acceptDocumentInvitation(invitationId, { token: token.value })
    await router.replace('/storage')
  } catch {
    error.value = 'This invitation is invalid or belongs to another account.'
  } finally {
    accepting.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-canvas p-6">
    <section class="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-xl">
      <div
        class="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent"
      >
        <icon-lucide-mail class="size-5" />
      </div>
      <h1 class="text-lg font-semibold text-surface">Document invitation</h1>
      <p v-if="loading" class="mt-3 text-sm text-muted">Loading invitation…</p>
      <p v-else-if="error" role="alert" class="mt-3 text-sm text-danger">{{ error }}</p>
      <template v-else-if="invitation">
        <p class="mt-3 text-sm leading-relaxed text-muted">
          {{ invitation.inviterName }} invited {{ invitation.recipientHint }} to
          {{ invitation.permission === 'edit' ? 'edit' : 'view' }}
          <strong class="text-surface">{{ invitation.documentName }}</strong
          >.
        </p>
        <p class="mt-2 text-xs text-muted">
          Expires {{ new Date(invitation.expiresAt).toLocaleString() }}
        </p>
        <AppTextButton class="mt-5 w-full justify-center" :disabled="accepting" @click="accept">
          {{ accepting ? 'Accepting…' : 'Accept invitation' }}
        </AppTextButton>
      </template>
    </section>
  </main>
</template>
