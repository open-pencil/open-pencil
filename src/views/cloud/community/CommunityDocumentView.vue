<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useClipboard } from '@vueuse/core'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import {
  cloudCommunityDesktopLinkURL,
  cloudCommunityPagePath,
  cloudCommunityURL,
  CLOUD_COMMUNITY_PATH
} from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { communityPublisher, useCommunityDocuments } from '@/app/cloud-portal/community'
import { usePortal } from '@/app/cloud-portal/context'
import { portalToast } from '@/app/cloud-portal/toast'
import { useDateFormat } from '@/app/i18n/date'
import BrandMark from '@/components/brand/BrandMark.vue'
import CommunityCard from '@/components/cloud-portal/community/CommunityCard.vue'
import CommunityImage from '@/components/cloud-portal/community/CommunityImage.vue'
import CommunityLayout from '@/components/cloud-portal/community/CommunityLayout.vue'
import PortalLoadAlert from '@/components/cloud-portal/layout/PortalLoadAlert.vue'
import { portalCommunity } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'

/**
 * A community file's page: its preview, what it is, its named versions, and the ways to open the
 * one picked, in this browser's editor or in the desktop app, both read-only; then more files.
 */
const MORE_FILES = 3
/** The radio value that stands for the file as it is now, rather than a named version's ID. */
const LATEST = 'latest'

const portal = usePortal()
const route = useRoute()
const messages = useCloudPortalMessages()
const dates = useDateFormat()
const ui = portalCommunity()
const { copy } = useClipboard({ legacy: true })
const { state, reload } = useCommunityDocuments(portal.discovery)
const publisher = communityPublisher(portal.discovery, portal.host)
const origin = globalThis.location.origin

const documents = computed(() => (state.value.status === 'ready' ? state.value.documents : []))
const document = computed(
  () => documents.value.find((entry) => entry.id === route.params.documentId) ?? null
)
const more = computed(() =>
  documents.value.filter((entry) => entry.id !== document.value?.id).slice(0, MORE_FILES)
)

const choice = ref(LATEST)
const versionId = computed(() => (choice.value === LATEST ? null : choice.value))
// Another file's page starts from its latest state.
watch(
  () => route.params.documentId,
  () => {
    choice.value = LATEST
  }
)

function openInBrowser(id: string) {
  globalThis.location.assign(cloudCommunityURL(origin, id, versionId.value))
}

function openInDesktop(id: string) {
  globalThis.location.assign(cloudCommunityDesktopLinkURL(id, origin, versionId.value))
}

async function copyLink(id: string) {
  await copy(new URL(cloudCommunityPagePath(id), origin).href)
  portalToast.info(messages.value.communityLinkCopied)
}

useHead(() => ({
  title: `${document.value?.name ?? messages.value.communityTitle} · ${portal.host}`
}))
</script>

<template>
  <CommunityLayout>
    <nav :class="ui.crumbs()" :aria-label="messages.communityTitle">
      <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.crumbLink()">
        {{ messages.communityTitle }}
      </RouterLink>
      <template v-if="document">
        <icon-lucide-chevron-right data-direction="reading" class="size-3.5 shrink-0" />
        <span :class="ui.crumbCurrent()" aria-current="page">{{ document.name }}</span>
      </template>
    </nav>
    <PortalLoadAlert v-if="state.status === 'failed'" :error="state.error" @retry="reload" />
    <template v-else-if="state.status === 'loading'">
      <span role="status" class="sr-only">{{ messages.loading }}</span>
      <div :class="ui.document()" aria-hidden="true">
        <AppSkeleton class="aspect-[16/10] w-full rounded-2xl" />
        <div :class="ui.aside()">
          <AppSkeleton class="h-7 w-56" />
          <AppSkeleton class="h-4 w-32" />
          <AppSkeleton class="h-10 w-full" />
          <AppSkeleton class="h-10 w-full" />
        </div>
      </div>
    </template>
    <AppPlaceholder
      v-else-if="!document"
      label-as="h1"
      :label="messages.communityNotFoundTitle"
      :description="messages.communityNotFoundDescription"
      :class="ui.empty()"
    />
    <template v-else>
      <div :class="ui.document()">
        <div :class="ui.preview()">
          <CommunityImage
            :key="document.thumbnailPath"
            :src="document.thumbnailPath"
            :alt="messages.communityPreview({ name: document.name })"
            eager
            :class="ui.previewImage()"
          />
        </div>
        <div :class="ui.aside()">
          <div :class="ui.heading()">
            <h1 :class="ui.documentTitle()">{{ document.name }}</h1>
            <span :class="ui.publisher()">
              <BrandMark variant="app-icon" decorative :class="ui.publisherMark()" />
              {{ publisher }}
            </span>
          </div>
          <div :class="ui.actions()">
            <AppButton
              size="lg"
              color="primary"
              variant="solid"
              @click="openInBrowser(document.id)"
            >
              <icon-lucide-pen-tool :class="ui.actionIcon()" />
              {{ messages.communityOpenInBrowser }}
            </AppButton>
            <AppButton
              size="lg"
              variant="outline"
              :class="ui.desktopAction()"
              @click="openInDesktop(document.id)"
            >
              <icon-lucide-monitor :class="ui.actionIcon()" />
              {{ messages.communityOpenInDesktop }}
            </AppButton>
            <AppButton size="lg" variant="ghost" @click="copyLink(document.id)">
              <icon-lucide-link :class="ui.actionIcon()" />
              {{ messages.communityCopyLink }}
            </AppButton>
            <p :class="ui.note()">{{ messages.communityOpenNote }}</p>
          </div>
          <dl :class="ui.details()">
            <dt :class="ui.detailTerm()">{{ messages.communityDetailType }}</dt>
            <dd :class="ui.detailValue()">
              {{
                document.kind === 'board'
                  ? messages.communityKindBoard
                  : messages.communityKindDesign
              }}
            </dd>
            <dt :class="ui.detailTerm()">{{ messages.communityDetailUpdated }}</dt>
            <dd :class="ui.detailValue()">{{ dates.format(document.updatedAt, 'date') }}</dd>
          </dl>
          <div v-if="document.versions.length > 0" :class="ui.versions()">
            <h2 :class="ui.sectionTitle()">{{ messages.communityVersions }}</h2>
            <RadioGroupRoot
              v-model="choice"
              :aria-label="messages.communityVersions"
              :class="ui.versions()"
            >
              <RadioGroupItem :value="LATEST" :class="ui.version()">
                <span :class="ui.versionDot()" aria-hidden="true" />
                <span :class="ui.versionName()">{{ messages.communityLatest }}</span>
                <span :class="ui.versionDate()">{{ dates.relative(document.updatedAt) }}</span>
                <span :class="ui.versionNotes()">{{ messages.communityLatestDescription }}</span>
              </RadioGroupItem>
              <RadioGroupItem
                v-for="version in document.versions"
                :key="version.id"
                :value="version.id"
                :class="ui.version()"
              >
                <span :class="ui.versionDot()" aria-hidden="true" />
                <span :class="ui.versionName()">{{ version.name }}</span>
                <span :class="ui.versionDate()">{{ dates.format(version.createdAt, 'day') }}</span>
                <span v-if="version.description" :class="ui.versionNotes()">
                  {{ version.description }}
                </span>
              </RadioGroupItem>
            </RadioGroupRoot>
          </div>
        </div>
      </div>
      <section v-if="more.length > 0" :class="ui.more()" aria-labelledby="community-more">
        <h2 id="community-more" :class="ui.sectionTitle()">{{ messages.communityMore }}</h2>
        <ul :class="ui.grid()">
          <li v-for="entry in more" :key="entry.id">
            <CommunityCard :document="entry" :publisher="publisher" />
          </li>
        </ul>
      </section>
    </template>
  </CommunityLayout>
</template>
