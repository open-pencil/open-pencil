<script setup lang="ts">
import { useHead } from '@unhead/vue'

import { cloudCommunityPagePath } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { useCommunityDocuments } from '@/app/cloud-portal/community'
import { usePortal } from '@/app/cloud-portal/context'
import { useDateFormat } from '@/app/i18n/date'
import CommunityLayout from '@/components/cloud-portal/community/CommunityLayout.vue'
import PortalLoadAlert from '@/components/cloud-portal/layout/PortalLoadAlert.vue'
import { portalCommunity } from '@/components/cloud-portal/ui'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'

/** The server's community gallery: every file in it, newest change first, each with its preview. */
const portal = usePortal()
const messages = useCloudPortalMessages()
const dates = useDateFormat()
const ui = portalCommunity()
const { state, reload } = useCommunityDocuments(portal.discovery)

useHead(() => ({ title: `${messages.value.communityTitle} · ${portal.host}` }))
</script>

<template>
  <CommunityLayout :host="portal.host">
    <div :class="ui.intro()">
      <h1 :class="ui.title()">{{ messages.communityTitle }}</h1>
      <p :class="ui.description()">{{ messages.communityDescription }}</p>
    </div>
    <PortalLoadAlert v-if="state.status === 'failed'" :error="state.error" @retry="reload" />
    <div v-else-if="state.status === 'loading'" :class="ui.grid()" aria-hidden="true">
      <div v-for="index in 6" :key="index" :class="ui.card()">
        <AppSkeleton :class="ui.cardPreview()" />
        <AppSkeleton class="h-3 w-40" />
      </div>
    </div>
    <p v-else-if="state.documents.length === 0" :class="ui.description()">
      {{ messages.communityEmpty }}
    </p>
    <ul v-else :class="ui.grid()">
      <li v-for="document in state.documents" :key="document.id">
        <RouterLink :to="cloudCommunityPagePath(document.id)" :class="ui.card()">
          <div :class="ui.cardPreview()">
            <img
              :src="document.thumbnailPath"
              :alt="messages.communityPreview({ name: document.name })"
              loading="lazy"
              :class="ui.previewImage()"
            />
          </div>
          <div :class="ui.cardText()">
            <span :class="ui.cardTitle()">{{ document.name }}</span>
            <span :class="ui.cardMeta()">
              {{
                document.kind === 'board'
                  ? messages.communityKindBoard
                  : messages.communityKindDesign
              }}
              · {{ messages.communityUpdated({ date: dates.format(document.updatedAt, 'date') }) }}
            </span>
          </div>
        </RouterLink>
      </li>
    </ul>
  </CommunityLayout>
</template>
