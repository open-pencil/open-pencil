<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { useId } from 'vue'

import { useDiagnosticsMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import campaignPromptTheme from '@/theme/campaigns/prompt'
import donationTheme from '@/theme/donation'
import promptTheme from '@/theme/sharing/prompt'
import questionTheme from '@/theme/sharing/question'

import CampaignIcon from './CampaignIcon.vue'
import CampaignMarkdown from './CampaignMarkdown.vue'
import type { CampaignView } from './types'

/**
 * A campaign in the corner the usage stats question and the donation ask use: its title and
 * Markdown body, Not now, and its action when it has one. What the buttons do is the caller's.
 */
const { content, kind } = defineProps<CampaignView>()
const emit = defineEmits<{ dismiss: []; act: [] }>()

const diagnostics = useDiagnosticsMessages()
const prompt = tv(promptTheme)()
const styles = tv(questionTheme)()
const donation = tv(donationTheme)()
const campaign = tv(campaignPromptTheme)()
const headingId = useId()
</script>

<template>
  <aside :class="prompt.root()" :aria-labelledby="headingId" data-test-id="campaign-prompt">
    <section :class="styles.root()">
      <h3 :id="headingId" :class="donation.heading()">
        <CampaignIcon :kind="kind" :class="campaign.icon()" />
        {{ content.title }}
      </h3>
      <CampaignMarkdown
        v-if="content.body"
        :content="content.body"
        density="comfortable"
        :class="campaign.body()"
      />
      <div :class="styles.actions()">
        <AppButton variant="outline" @click="emit('dismiss')">
          {{ diagnostics.campaignNotNow }}
        </AppButton>
        <AppButton v-if="content.action" color="primary" variant="solid" @click="emit('act')">
          {{ content.action.label }}
        </AppButton>
      </div>
    </section>
  </aside>
</template>
