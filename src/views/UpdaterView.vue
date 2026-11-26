<script setup lang="ts">
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useHead } from '@unhead/vue'
import { computed, onMounted, onScopeDispose, watch } from 'vue'

import { useMessages, useLocale } from '@open-pencil/vue/i18n'

import { APP_VERSION } from '@/app/runtime/version'
import { appPreferences } from '@/app/settings/preferences/store'
import { animationsEnabled } from '@/app/shell/motion'
import { useAppTheme } from '@/app/shell/theme'
import { resolveUpdateChannel } from '@/app/shell/updater/channel'
import { createTauriUpdaterBackend, createUpdaterSession } from '@/app/shell/updater/session'
import UpdatePrompt from '@/components/updater/UpdatePrompt.vue'

const updates = useMessages('updates')
const { locale } = useLocale()

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
// The editor's Settings can switch channels while this window offers the other channel's build;
// preferences live in storage both windows read, so the change reaches this one too.
watch(
  () => resolveUpdateChannel(appPreferences.value.updates.channel),
  () => void session.recheck()
)

let stopCloseGuard: (() => void) | undefined
let disposed = false
onMounted(async () => {
  void session.check()
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
