<script setup lang="ts">
import { cloudCommunityPagePath, type CommunityDocument } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { useDateFormat } from '@/app/i18n/date'
import BrandMark from '@/components/brand/BrandMark.vue'
import { portalCommunity } from '@/components/cloud-portal/ui'

import CommunityImage from './CommunityImage.vue'

/** A file in the gallery grid: its preview, newest named version, name, and who it is from. */
const { document, publisher } = defineProps<{ document: CommunityDocument; publisher: string }>()

const ui = portalCommunity()
const messages = useCloudPortalMessages()
const dates = useDateFormat()
</script>

<template>
  <RouterLink :to="cloudCommunityPagePath(document.id)" :class="ui.card()">
    <div :class="ui.cardFrame()">
      <CommunityImage
        :src="document.thumbnailPath"
        :alt="messages.communityPreview({ name: document.name })"
        :class="ui.cardImage()"
      />
      <div v-if="document.versions[0]" :class="ui.badges()">
        <span :class="ui.badge()">{{ document.versions[0].name }}</span>
      </div>
    </div>
    <div :class="ui.cardBody()">
      <BrandMark variant="app-icon" decorative :class="ui.publisherMark()" />
      <div :class="ui.cardText()">
        <span :class="ui.cardTitle()">{{ document.name }}</span>
        <span :class="ui.cardMeta()">
          {{ publisher }} ·
          {{ messages.communityUpdated({ date: dates.relative(document.updatedAt) }) }}
        </span>
      </div>
    </div>
  </RouterLink>
</template>
