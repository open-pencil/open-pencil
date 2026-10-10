<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { cloudEditorReturnURL } from '@open-pencil/cloud/client'
import { useCloudPortalMessages } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { PORTAL_HOME } from '@/app/cloud-portal/navigation'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()

function editorDestination(editor: string): string | null {
  if (!editor) return null
  try {
    return cloudEditorReturnURL(portal.discovery, editor)
  } catch {
    return null
  }
}

// The editor sent the person here to sign in; only this server's own editor may get them back.
onMounted(() => {
  const editor = typeof route.query.editor === 'string' ? route.query.editor : ''
  const destination = editorDestination(editor)
  if (destination) globalThis.location.replace(destination)
  else void router.replace(PORTAL_HOME)
})
</script>

<template>
  <main class="flex h-full bg-app text-surface">
    <AppPlaceholder size="page" :label="messages.loading">
      <template #icon>
        <icon-lucide-loader-circle class="size-5 animate-spin motion-reduce:animate-none" />
      </template>
    </AppPlaceholder>
  </main>
</template>
