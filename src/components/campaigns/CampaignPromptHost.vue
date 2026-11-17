<script setup lang="ts">
import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

import type { CampaignContent } from '@open-pencil/feedback/contract'
import { locale, useDiagnosticsMessages } from '@open-pencil/vue/i18n'

import { actOnCampaign, dismissCampaign, isBuiltInCampaign, promptCampaign } from '@/app/campaigns'
import { campaignContent } from '@/app/campaigns/schedule'
import { DONATION_URL } from '@/app/donation'

import CampaignPrompt from './CampaignPrompt.vue'

/**
 * The corner prompt, when a campaign is due this launch: a served campaign in the app's language,
 * or the app's own donation ask in its own translations.
 */
const diagnostics = useDiagnosticsMessages()
const language = useStore(locale)

const content = computed<CampaignContent | null>(() => {
  const campaign = promptCampaign.value
  if (!campaign) return null
  if (!isBuiltInCampaign(campaign)) return campaignContent(campaign, language.value)
  return {
    title: diagnostics.value.supportTitle,
    body: diagnostics.value.supportDescription,
    action: DONATION_URL ? { label: diagnostics.value.supportDonate, url: DONATION_URL } : undefined
  }
})
</script>

<template>
  <CampaignPrompt
    v-if="promptCampaign && content"
    :content="content"
    :kind="promptCampaign.kind"
    @dismiss="dismissCampaign(promptCampaign, 'prompt')"
    @act="actOnCampaign(promptCampaign, 'prompt', content)"
  />
</template>
