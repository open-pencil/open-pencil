<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { computed, onMounted, shallowRef } from 'vue'

import type { Campaign, CampaignPlacement } from '@open-pencil/feedback/contract'
import { locale } from '@open-pencil/vue/i18n'

import { actOnCampaign, campaignNote, dismissCampaign } from '@/app/campaigns'
import { campaignContent } from '@/app/campaigns/schedule'

import CampaignNote from './CampaignNote.vue'

/**
 * A served campaign's note in `placement`, when one is due as the place opens, in the app's
 * language. Dismissing it or following its action puts it away.
 */
const { placement } = defineProps<{ placement: Exclude<CampaignPlacement, 'prompt'> }>()

const language = useStore(locale)
const campaign = shallowRef<Campaign | null>(null)
const content = computed(() =>
  campaign.value ? campaignContent(campaign.value, language.value) : null
)

onMounted(async () => {
  campaign.value = await campaignNote(placement)
})

function dismiss(shown: Campaign) {
  dismissCampaign(shown, placement)
  campaign.value = null
}

function act(shown: Campaign) {
  if (content.value) actOnCampaign(shown, placement, content.value)
  campaign.value = null
}
</script>

<template>
  <CampaignNote
    v-if="campaign && content"
    :content="content"
    :kind="campaign.kind"
    @dismiss="dismiss(campaign)"
    @act="act(campaign)"
  />
</template>
