<script setup lang="ts">
import { getLocalTimeZone } from '@internationalized/date'
import { computed } from 'vue'

import { useLocale, useMessages } from '@open-pencil/vue/i18n'

import { CLOUD_MOVE_DAY, isMovingSite, movedURL } from '@/app/cloud/moving'
import { formatDate } from '@/app/i18n/date'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'
import { OFFICIAL_CLOUD_URL } from '@/constants'

/**
 * On the web app's old address only: OpenPencil is moving to the official Cloud site, files kept
 * in this browser stay behind, and the same page opens there. It stays until the address
 * redirects, so nobody loses files to a notice they closed once.
 */
const cloud = useMessages('cloud/editor')
const { locale } = useLocale()
const show = isMovingSite(window.location.origin)
const host = new URL(OFFICIAL_CLOUD_URL).host
const date = computed(() =>
  formatDate(CLOUD_MOVE_DAY.toDate(getLocalTimeZone()), 'date', locale.value)
)

function open() {
  window.location.assign(movedURL(window.location))
}
</script>

<template>
  <AppBanner v-if="show" @action="open">
    {{ cloud.movingBanner({ host, date }) }}
    <template #action>{{ cloud.movingOpen }}</template>
  </AppBanner>
</template>
