<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useClipboard } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  cloudCommunityPagePath,
  CLOUD_COMMUNITY_PATH,
  type CommunityDocument
} from '@open-pencil/cloud/contract'
import { useCloudMessages, useCloudPortalMessages, useFileMessages } from '@open-pencil/vue/i18n'

import {
  openCommunityInBrowser,
  openCommunityInDesktop,
  useCommunityDocuments
} from '@/app/cloud-portal/community'
import { usePortal } from '@/app/cloud-portal/context'
import { useDateFormat } from '@/app/i18n/date'
import CommunityLayout from '@/components/cloud-portal/community/CommunityLayout.vue'
import PortalLoadAlert from '@/components/cloud-portal/layout/PortalLoadAlert.vue'
import CloudVersionListItem from '@/components/cloud/versions/CloudVersionListItem.vue'
import { cloudVersions } from '@/components/cloud/versions/ui'
import { DOCUMENT_KIND_ICONS } from '@/components/document/kinds'
import DocumentEntry from '@/components/home/document/DocumentEntry.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import documentEntryTheme from '@/theme/home/document-entry'

/**
 * A community file's page: its preview in the frame Home shows files in, the ways to open the
 * state picked, in this browser's editor or in the desktop app, both read-only, its link, and its
 * history as the editor's version history lists it; then more files from the gallery.
 */
const MORE_FILES = 4

const documentEntry = tv(documentEntryTheme)
const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const cloud = useCloudMessages()
const files = useFileMessages()
const dates = useDateFormat()
const versions = cloudVersions()
const { state, reload } = useCommunityDocuments(portal.discovery)
const origin = globalThis.location.origin
const { copy, copied } = useClipboard({ legacy: true })

const documents = computed(() => (state.value.status === 'ready' ? state.value.documents : []))
const document = computed(
  () => documents.value.find((entry) => entry.id === route.params.documentId) ?? null
)
const frame = computed(() => documentEntry({ view: 'grid', kind: document.value?.kind }))
const more = computed(() =>
  documents.value.filter((entry) => entry.id !== document.value?.id).slice(0, MORE_FILES)
)
const pageURL = computed(() =>
  document.value ? new URL(cloudCommunityPagePath(document.value.id), origin).href : ''
)

/** The named version to open, or null for the file as it is now. */
const versionId = ref<string | null>(null)
// Another file's page starts from its current state.
watch(
  () => route.params.documentId,
  () => {
    versionId.value = null
  }
)

function openPage(entry: CommunityDocument) {
  void router.push(cloudCommunityPagePath(entry.id))
}

useHead({ title: () => document.value?.name ?? messages.value.communityTitle })
</script>

<template>
  <CommunityLayout>
    <PortalLoadAlert v-if="state.status === 'failed'" :error="state.error" @retry="reload" />
    <div
      v-else-if="state.status === 'loading'"
      class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"
      aria-hidden="true"
    >
      <AppSkeleton class="aspect-video w-full rounded-lg" />
      <div class="flex flex-col gap-3">
        <AppSkeleton class="w-40" />
        <AppSkeleton class="h-8 w-full" />
        <AppSkeleton class="h-8 w-full" />
      </div>
    </div>
    <AppPlaceholder
      v-else-if="!document"
      label-as="h1"
      :label="messages.communityNotFoundTitle"
      :description="messages.communityNotFoundDescription"
    >
      <template #action>
        <AppButton variant="outline" @click="router.push(CLOUD_COMMUNITY_PATH)">
          {{ messages.communityAllFiles }}
        </AppButton>
      </template>
    </AppPlaceholder>
    <template v-else>
      <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div :class="frame.preview({ class: 'group-hover:border-border' })">
          <img :src="document.thumbnailPath" alt="" :class="frame.image({ class: 'scale-100' })" />
        </div>
        <div class="flex flex-col gap-4">
          <div class="min-w-0">
            <h1 class="flex items-center gap-1.5 text-base font-semibold">
              <component
                :is="DOCUMENT_KIND_ICONS[document.kind]"
                :class="frame.kind()"
                aria-hidden="true"
              />
              <span class="truncate">{{ document.name }}</span>
            </h1>
            <p class="mt-0.5 text-xs text-muted">
              {{ document.kind === 'board' ? files.createBoard : files.createDesign }} ·
              {{ dates.format(document.updatedAt, 'date') }}
            </p>
          </div>
          <div class="flex flex-col gap-2">
            <AppButton
              color="primary"
              variant="solid"
              @click="openCommunityInBrowser({ documentId: document.id, versionId })"
            >
              {{ messages.communityOpenInBrowser }}
            </AppButton>
            <AppButton
              variant="outline"
              class="max-sm:hidden"
              @click="openCommunityInDesktop({ documentId: document.id, versionId })"
            >
              {{ messages.communityOpenInDesktop }}
            </AppButton>
            <AppButton variant="outline" @click="copy(pageURL)">
              <template #leading>
                <icon-lucide-check v-if="copied" class="size-3.5" />
                <icon-lucide-link v-else class="size-3.5" />
              </template>
              {{ copied ? cloud.shareLinkCopied : cloud.shareCopyLink }}
            </AppButton>
            <p class="text-pretty text-xs text-muted">{{ messages.communityOpenNote }}</p>
          </div>
          <div
            v-if="document.versions.length > 0"
            class="overflow-hidden rounded-lg border border-border bg-panel"
          >
            <ul :class="versions.list()" :aria-label="cloud.versionHistory">
              <CloudVersionListItem
                v-if="!document.versions[0]?.current"
                :label="cloud.currentVersion"
                current
                :selected="versionId === null"
                @select="versionId = null"
              />
              <CloudVersionListItem
                v-for="(version, index) in document.versions"
                :key="version.id"
                :label="
                  index === 0
                    ? messages.communityLatestVersion({ name: version.name })
                    : version.name
                "
                :description="version.description"
                :at="version.createdAt"
                named
                :selected="versionId === version.id || (versionId === null && version.current)"
                :last="index === document.versions.length - 1"
                @select="versionId = version.id"
              />
            </ul>
          </div>
        </div>
      </div>

      <section v-if="more.length > 0" class="mt-10">
        <h2 class="mb-3 text-base font-semibold">{{ messages.communityMore }}</h2>
        <div
          class="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))]"
        >
          <DocumentEntry
            v-for="entry in more"
            :key="entry.id"
            :name="entry.name"
            :kind="entry.kind"
            :metadata="dates.format(entry.updatedAt, 'date')"
            :previewURL="entry.thumbnailPath"
            @open="openPage(entry)"
          />
        </div>
      </section>
    </template>
  </CommunityLayout>
</template>
