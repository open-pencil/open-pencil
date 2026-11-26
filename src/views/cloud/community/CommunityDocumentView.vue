<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  cloudCommunityPagePath,
  CLOUD_COMMUNITY_PATH,
  type CommunityDocument
} from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

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
import AppCopyButton from '@/components/ui/button/AppCopyButton.vue'
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
const communityMessages = useMessages('cloud/portal/community')
const cloud = useMessages('cloud/editor')
const files = useMessages('files')
const dates = useDateFormat()
const versions = cloudVersions()
const { state, reload } = useCommunityDocuments(portal.discovery)
const origin = globalThis.location.origin

const documents = computed(() => (state.value.status === 'ready' ? state.value.documents : []))
const document = computed(
  () => documents.value.find((entry) => entry.id === route.params.documentId) ?? null
)
const frame = computed(() => documentEntry({ view: 'grid', kind: document.value?.kind }))
const more = computed(() =>
  documents.value.filter((entry) => entry.id !== document.value?.id).slice(0, MORE_FILES)
)
const kindLabel = computed(
  () =>
    ({
      design: files.value.createDesign,
      board: files.value.createBoard,
      slides: files.value.createSlides
    })[document.value?.kind ?? 'design']
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

useHead({ title: () => document.value?.name ?? communityMessages.value.communityTitle })
</script>

<template>
  <CommunityLayout>
    <PortalLoadAlert v-if="state.status === 'failed'" :error="state.error" @retry="reload" />
    <div v-else-if="state.status === 'loading'" class="flex flex-col gap-6" aria-hidden="true">
      <div class="flex flex-col gap-3">
        <AppSkeleton class="w-32" />
        <AppSkeleton class="h-8 w-72 max-w-full" />
        <AppSkeleton class="w-full max-w-xl" />
      </div>
      <AppSkeleton class="aspect-video w-full rounded-xl" />
    </div>
    <AppPlaceholder
      v-else-if="!document"
      label-as="h1"
      :label="communityMessages.communityNotFoundTitle"
      :description="communityMessages.communityNotFoundDescription"
    >
      <template #action>
        <AppButton variant="outline" @click="router.push(CLOUD_COMMUNITY_PATH)">
          {{ communityMessages.communityAllFiles }}
        </AppButton>
      </template>
    </AppPlaceholder>
    <template v-else>
      <header class="flex items-start justify-between gap-6">
        <div class="min-w-0">
          <p class="flex items-center gap-1.5 text-xs text-muted">
            <component
              :is="DOCUMENT_KIND_ICONS[document.kind]"
              :class="frame.kind()"
              aria-hidden="true"
            />
            {{ kindLabel }}
          </p>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight text-balance">
            {{ document.name }}
          </h1>
          <p class="mt-1 text-xs text-muted">
            {{
              communityMessages.communityUpdated({ date: dates.format(document.updatedAt, 'date') })
            }}
          </p>
        </div>
        <AppButton
          color="neutral"
          variant="solid"
          size="lg"
          class="mt-6 shrink-0"
          @click="openCommunityInBrowser({ documentId: document.id, versionId })"
        >
          {{ communityMessages.communityOpenInBrowser }}
        </AppButton>
      </header>

      <div
        class="mt-6 flex aspect-[2/1] items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field"
      >
        <img :src="document.thumbnailPath" :alt="document.name" class="size-full object-contain" />
      </div>

      <div class="mt-10 grid gap-10 border-t border-border pt-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div class="flex min-w-0 flex-col gap-8">
          <p v-if="document.description" class="max-w-2xl text-sm/relaxed text-pretty">
            {{ document.description }}
          </p>
          <section v-if="document.versions.length > 0">
            <h2 class="mb-3 text-sm font-semibold">{{ cloud.versionHistory }}</h2>
            <div class="overflow-hidden rounded-lg border border-border bg-panel">
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
                      ? communityMessages.communityLatestVersion({ name: version.name })
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
          </section>
        </div>
        <aside class="flex flex-col gap-6 text-xs">
          <section class="max-sm:hidden">
            <AppButton
              variant="outline"
              size="md"
              @click="openCommunityInDesktop({ documentId: document.id, versionId })"
            >
              <template #leading><icon-lucide-monitor /></template>
              {{ communityMessages.communityOpenInDesktop }}
            </AppButton>
          </section>
          <section>
            <h2 class="mb-3 text-sm font-semibold">{{ cloud.share }}</h2>
            <AppCopyButton
              :value="pageURL"
              :label="cloud.shareCopyLink"
              :copied-label="cloud.shareLinkCopied"
              size="md"
              variant="outline"
            >
              <template #icon><icon-lucide-link /></template>
            </AppCopyButton>
          </section>
          <p class="border-t border-border pt-6 text-muted">
            {{ communityMessages.communityOpenNote }}
          </p>
        </aside>
      </div>

      <section v-if="more.length > 0" class="mt-12">
        <h2 class="mb-3 text-base font-semibold">{{ communityMessages.communityMore }}</h2>
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
