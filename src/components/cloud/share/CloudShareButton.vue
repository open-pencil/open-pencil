<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'

import type { DocumentPermission } from '@open-pencil/cloud/contract'
import { useI18n } from '@open-pencil/vue'

import { cloudConnection } from '@/app/cloud/sessions/connection'
import { cloudShareOpen } from '@/app/cloud/sharing/dialog'
import {
  changeCloudLink,
  changeCloudMember,
  cloudLinkURL,
  cloudShareTarget,
  inviteToCloudDocument,
  readCloudSharing,
  resetCloudLink,
  type CloudShareLink,
  type CloudSharing
} from '@/app/cloud/sharing/document'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { shareButton } from '@/theme/collaboration/share-button'

import CloudShareDialog from './CloudShareDialog.vue'

/** Share for a Cloud document: who can open it and its link, managed on the server. */
const store = useEditorStore()
const { collaboration, locale } = useI18n()
const sharing = shallowRef<CloudSharing | null>(null)
const inviting = ref(false)
const { copy, copied } = useClipboard({ legacy: true })

const target = computed(() => {
  const binding = store.getStorageBinding()
  return binding ? cloudShareTarget(binding) : null
})
const workspace = computed(() => {
  const binding = store.getStorageBinding()
  if (!binding?.profileId) return null
  const found = cloudConnection(binding.profileId).workspaces.find(
    (candidate) => candidate.id === binding.containerId
  )
  return found ? { name: found.name, permission: 'edit' as const } : null
})
const expires = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }).format(new Date(iso))
const members = computed(() =>
  (sharing.value?.members ?? []).map((member) => ({
    ...member,
    pendingUntil: member.pendingUntil ? expires(member.pendingUntil) : undefined
  }))
)

async function refresh() {
  const current = target.value
  if (!current) return
  try {
    sharing.value = await readCloudSharing(current)
  } catch {
    toast.error('Couldn’t load who has access. Check your connection and try again.')
  }
}

/** Runs a change on the server and shows what it left. */
async function change(run: () => Promise<void>) {
  try {
    await run()
  } catch {
    toast.error('That change didn’t go through. Try again in a moment.')
  }
  await refresh()
}

async function invite(email: string, permission: DocumentPermission) {
  const current = target.value
  if (!current) return
  inviting.value = true
  await change(() => inviteToCloudDocument(current, email, permission))
  inviting.value = false
}

function changeMember(id: string, permission: DocumentPermission | 'remove') {
  const current = target.value
  if (current) void change(() => changeCloudMember(current, id, permission))
}

function changeLink(link: CloudShareLink) {
  const current = target.value
  if (current) void change(() => changeCloudLink(current, link))
}

function resetLink() {
  const current = target.value
  if (current) void change(() => resetCloudLink(current))
}

async function copyLink() {
  const current = target.value
  const url = current ? await cloudLinkURL(current) : null
  if (url) await copy(url)
}

watch(cloudShareOpen, (open) => {
  if (open) void refresh()
})
</script>

<template>
  <button
    data-test-id="cloud-share-button"
    :class="shareButton({ connection: 'idle' })"
    :disabled="!target"
    @click="cloudShareOpen = true"
  >
    <icon-lucide-share-2 class="size-3.5" />
    {{ collaboration.share }}
  </button>
  <CloudShareDialog
    v-if="target"
    v-model:open="cloudShareOpen"
    :document-name="store.state.documentName"
    :workspace="workspace"
    :members="members"
    :link="sharing?.link ?? { access: 'restricted' }"
    :can-manage="sharing?.canManage ?? false"
    :links="sharing?.links"
    :inviting="inviting"
    :copied="copied"
    @invite="invite"
    @change-member="changeMember"
    @change-link="changeLink"
    @copy-link="copyLink"
    @reset-link="resetLink"
  />
</template>
