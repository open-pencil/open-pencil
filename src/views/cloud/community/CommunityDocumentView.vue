<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'
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
          @click="openCommunityInBrowser({ documentId: document.id, versionId: null })"
        >
          {{ communityMessages.communityOpenInBrowser }}
        </AppButton>
      </header>

      <div
        class="mt-6 flex aspect-[2/1] items-center justify-center overflow-hidden rounded-lg border border-border bg-panel-field"
      >
        <img :src="document.thumbnailPath" :alt="document.name" class="size-full object-contain" />
      </div>

      <div class="@container/details mt-10 border-t border-border pt-8">
        <div class="grid gap-10 @3xl/details:grid-cols-[minmax(0,1fr)_16rem]">
          <div class="flex min-w-0 flex-col gap-8">
            <p v-if="document.description" class="max-w-2xl text-sm/relaxed text-pretty">
              {{ document.description }}
            </p>
            <section v-if="document.versions.length > 0">
              <h2 class="mb-2 text-sm font-semibold">{{ cloud.versionHistory }}</h2>
              <ul class="divide-y divide-border border-y border-border">
                <li
                  v-for="version in document.versions"
                  :key="version.id"
                  class="flex items-center gap-4 py-3"
                >
                  <div class="min-w-0 flex-1">
                    <p class="text-sm">
                      <span class="font-medium">{{ version.name }}</span>
                      <span class="ms-2 text-muted">
                        {{ dates.format(version.createdAt, 'date') }}
                      </span>
                    </p>
                    <p v-if="version.description" class="mt-0.5 text-xs text-muted">
                      {{ version.description }}
                    </p>
                  </div>
                  <AppButton
                    size="md"
                    class="gap-1.5 font-normal"
                    :aria-label="communityMessages.communityOpenVersion({ name: version.name })"
                    @click="
                      openCommunityInBrowser({ documentId: document.id, versionId: version.id })
                    "
                  >
                    <template #leading><icon-lucide-external-link /></template>
                    {{ communityMessages.communityOpen }}
                  </AppButton>
                </li>
              </ul>
            </section>
          </div>
          <aside class="flex flex-col gap-1">
            <AppButton
              size="lg"
              class="justify-start gap-2 font-normal max-sm:hidden"
              @click="openCommunityInDesktop({ documentId: document.id, versionId: null })"
            >
              <template #leading><icon-lucide-monitor /></template>
              {{ communityMessages.communityOpenInDesktop }}
            </AppButton>
            <AppCopyButton
              :value="pageURL"
              :label="cloud.shareCopyLink"
              :copied-label="cloud.shareLinkCopied"
              size="lg"
              class="justify-start gap-2 font-normal"
            >
              <template #icon><icon-lucide-link /></template>
            </AppCopyButton>
          </aside>
        </div>
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
