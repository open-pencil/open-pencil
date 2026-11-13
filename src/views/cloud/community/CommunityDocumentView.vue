<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  cloudCommunityDesktopLinkURL,
  cloudCommunityURL,
  CLOUD_COMMUNITY_PATH
} from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { useCommunityDocuments } from '@/app/cloud-portal/community'
import { usePortal } from '@/app/cloud-portal/context'
import { useDateFormat } from '@/app/i18n/date'
import CommunityLayout from '@/components/cloud-portal/community/CommunityLayout.vue'
import PortalLoadAlert from '@/components/cloud-portal/layout/PortalLoadAlert.vue'
import { portalCommunity } from '@/components/cloud-portal/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'

/**
 * A community file's page: its preview, what it is, its named versions, and the ways to open the
 * one picked, in this browser's editor or in the desktop app. Both open it read-only.
 */
const portal = usePortal()
const route = useRoute()
const messages = useCloudPortalMessages()
const dates = useDateFormat()
const ui = portalCommunity()
const { state, reload } = useCommunityDocuments(portal.discovery)

const document = computed(() =>
  state.value.status === 'ready'
    ? (state.value.documents.find((entry) => entry.id === route.params.documentId) ?? null)
    : null
)
/** The radio value that stands for the file as it is now, rather than a named version's ID. */
const LATEST = 'latest'
/** The named version to open, or `LATEST`. */
const choice = ref(LATEST)
const versionId = computed(() => (choice.value === LATEST ? null : choice.value))
const origin = globalThis.location.origin

function openInBrowser(id: string) {
  globalThis.location.assign(cloudCommunityURL(origin, id, versionId.value))
}

function openInDesktop(id: string) {
  globalThis.location.assign(cloudCommunityDesktopLinkURL(id, origin, versionId.value))
}

useHead(() => ({
  title: `${document.value?.name ?? messages.value.communityTitle} · ${portal.host}`
}))
</script>

<template>
  <CommunityLayout :host="portal.host">
    <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.back()">
      <icon-lucide-arrow-left data-direction="reading" class="size-3.5" />
      {{ messages.communityAllFiles }}
    </RouterLink>
    <PortalLoadAlert v-if="state.status === 'failed'" :error="state.error" @retry="reload" />
    <div v-else-if="state.status === 'loading'" :class="ui.document()" aria-hidden="true">
      <AppSkeleton :class="ui.documentPreview()" />
      <div :class="ui.aside()">
        <AppSkeleton class="h-6 w-48" />
        <AppSkeleton class="h-8 w-full" />
      </div>
    </div>
    <AppPlaceholder
      v-else-if="!document"
      label-as="h1"
      :label="messages.communityNotFoundTitle"
      :description="messages.communityNotFoundDescription"
    />
    <div v-else :class="ui.document()">
      <div :class="ui.documentPreview()">
        <img
          :src="document.thumbnailPath"
          :alt="messages.communityPreview({ name: document.name })"
          :class="ui.previewImage()"
        />
      </div>
      <div :class="ui.aside()">
        <div :class="ui.intro()">
          <h1 :class="ui.title()">{{ document.name }}</h1>
          <p :class="ui.cardMeta()">
            {{
              document.kind === 'board' ? messages.communityKindBoard : messages.communityKindDesign
            }}
            · {{ messages.communityUpdated({ date: dates.format(document.updatedAt, 'date') }) }}
          </p>
        </div>
        <div :class="ui.actions()">
          <AppButton size="lg" color="primary" variant="solid" @click="openInBrowser(document.id)">
            {{ messages.communityOpenInBrowser }}
          </AppButton>
          <AppButton
            size="lg"
            variant="outline"
            :class="ui.desktopAction()"
            @click="openInDesktop(document.id)"
          >
            {{ messages.communityOpenInDesktop }}
          </AppButton>
          <p :class="ui.note()">{{ messages.communityOpenNote }}</p>
        </div>
        <div v-if="document.versions.length > 0" :class="ui.versions()">
          <h2 :class="ui.versionsTitle()">{{ messages.communityVersions }}</h2>
          <RadioGroupRoot
            v-model="choice"
            :aria-label="messages.communityVersions"
            :class="ui.versions()"
          >
            <RadioGroupItem :value="LATEST" :class="ui.version()">
              <span :class="ui.versionName()">{{ messages.communityLatest }}</span>
              <span :class="ui.versionMeta()">{{ messages.communityLatestDescription }}</span>
            </RadioGroupItem>
            <RadioGroupItem
              v-for="version in document.versions"
              :key="version.id"
              :value="version.id"
              :class="ui.version()"
            >
              <span :class="ui.versionName()">{{ version.name }}</span>
              <span :class="ui.versionMeta()">
                {{ version.description ?? dates.format(version.createdAt, 'date') }}
              </span>
            </RadioGroupItem>
          </RadioGroupRoot>
        </div>
      </div>
    </div>
  </CommunityLayout>
</template>
