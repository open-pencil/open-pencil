<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, onScopeDispose } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { animationsEnabled } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import { createTauriUpdaterBackend, createUpdaterSession } from '@/app/shell/updater/session'
import UpdatePrompt from '@/components/updater/UpdatePrompt.vue'
import { APP_VERSION } from '@/constants'

const { updates, locale } = useI18n()

useHead({
  title: () => updates.value.windowTitle,
  htmlAttrs: {
    lang: locale,
    'data-motion': computed(() => (animationsEnabled.value ? 'full' : 'off'))
  }
})
useAppTheme()

const backend = createTauriUpdaterBackend()
const session = createUpdaterSession(backend)

let stopCloseGuard: (() => void) | undefined
let disposed = false
onMounted(async () => {
  void session.check()
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  // Closing mid-install would leave the app half replaced.
  const stop = await getCurrentWindow().onCloseRequested((event) => {
    if (session.state.value.status === 'installing') event.preventDefault()
  })
  if (disposed) stop()
  else stopCloseGuard = stop
})
onScopeDispose(() => {
  disposed = true
  stopCloseGuard?.()
})
</script>

<template>
  <UpdatePrompt
    class="h-dvh"
    :current-version="APP_VERSION"
    :install-quits-app="backend.installQuitsApp"
    :state="session.state.value"
    @install="session.install"
    @cancel="session.cancel"
    @restart="session.restart"
    @retry="session.retry"
    @dismiss="session.dismiss"
  />
</template>
