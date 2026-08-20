<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { createCloudAuthClient, discoverCloud, signInToCloud } from '@open-pencil/cloud/client'

import AppTextButton from '@/components/ui/AppTextButton.vue'

const route = useRoute()
const userCode = typeof route.query.user_code === 'string' ? route.query.user_code : ''
const loading = ref(true)
const error = ref('')
const status = ref<'pending' | 'approved' | 'denied'>('pending')
const discovery = ref<Awaited<ReturnType<typeof discoverCloud>> | null>(null)

async function load() {
  try {
    discovery.value = await discoverCloud(window.location.origin)
    const result = await createCloudAuthClient(discovery.value).device({
      query: { user_code: userCode }
    })
    if (result.error) {
      error.value = result.error.error_description
      return
    }
    status.value =
      result.data.status === 'approved' || result.data.status === 'denied'
        ? result.data.status
        : 'pending'
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    loading.value = false
  }
}

async function approve() {
  if (!discovery.value) return
  const client = createCloudAuthClient(discovery.value)
  const session = await client.getSession()
  if (!session.data?.session) {
    const provider = discovery.value.authentication.socialProviders[0]
    if (!provider) {
      error.value = 'No sign-in provider is configured.'
      return
    }
    await signInToCloud(discovery.value, provider, window.location.href)
    return
  }
  const result = await client.device.approve({ userCode })
  if (result.error) {
    error.value = result.error.error_description
    return
  }
  status.value = 'approved'
}

async function deny() {
  if (!discovery.value) return
  const result = await createCloudAuthClient(discovery.value).device.deny({ userCode })
  if (result.error) {
    error.value = result.error.error_description
    return
  }
  status.value = 'denied'
}

onMounted(load)
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-canvas p-6">
    <section class="w-full max-w-md rounded-lg border border-border bg-panel p-6 shadow-xl">
      <div
        class="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/15 text-accent"
      >
        <icon-lucide-monitor-check class="size-5" />
      </div>
      <h1 class="text-lg font-semibold text-surface">Authorize OpenPencil desktop</h1>
      <p v-if="loading" class="mt-3 text-sm text-muted">Loading authorization…</p>
      <p v-else-if="error" role="alert" class="mt-3 text-sm text-danger">{{ error }}</p>
      <template v-else-if="status === 'pending'">
        <p class="mt-3 text-sm leading-relaxed text-muted">
          Confirm that the desktop app showing code
          <strong class="text-surface">{{ userCode }}</strong> may access this Cloud account.
        </p>
        <div class="mt-5 flex gap-2">
          <AppTextButton class="flex-1 justify-center" @click="deny">Deny</AppTextButton>
          <AppTextButton class="flex-1 justify-center" @click="approve">Authorize</AppTextButton>
        </div>
      </template>
      <p v-else-if="status === 'approved'" class="mt-3 text-sm text-surface">
        Desktop authorized. You can return to OpenPencil.
      </p>
      <p v-else class="mt-3 text-sm text-muted">Authorization denied.</p>
    </section>
  </main>
</template>
