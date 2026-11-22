<script setup lang="ts">
import { Link } from '@vue-email/components'

import type { EnrollmentEmailPayload } from '../schema'
import { BUG_REPORT_URL, DOWNLOAD_URL, styles } from './brand'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/**
 * A letter from OpenPencil's founder to someone who asked for the official Cloud before it opened,
 * or joined its waitlist on openpencil.dev: thanks for waiting, it is a beta, and where to say what
 * breaks. Replies reach a person, through the deployment's reply address. The waitlist gave no
 * name, so its letter opens with the thanks rather than a greeting.
 */
const { payload } = defineProps<{ payload: EnrollmentEmailPayload }>()

const localization = useEmailLocalization()
const { t } = localization
// Each translation places its link inside the sentence, where `{link}` is.
// The waitlist letter already says Cloud is open, so its beta paragraph starts at the beta.
const beta = payload.waitlist ? t.invitationWaitlistBeta : t.invitationBeta
const [beforeIssue = '', afterIssue = ''] = beta.split('{link}')
const [beforeDownload = '', afterDownload = ''] = t.invitationDesktop.split('{link}')
</script>

<template>
  <BrandEmail
    :preview="payload.waitlist ? t.invitationWaitlistPreview : t.invitationPreview"
    :heading="t.invitationHeading"
    :action="{ label: t.invitationAction, url: payload.actionURL }"
  >
    <EmailText v-if="payload.waitlist">{{ t.invitationWaitlistThanks }}</EmailText>
    <template v-else>
      <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
      <EmailText>{{ t.invitationThanks }}</EmailText>
    </template>
    <EmailText>
      {{ beforeIssue
      }}<Link :href="BUG_REPORT_URL" :style="styles.link">{{ t.invitationIssueLink }}</Link
      >{{ afterIssue }}
    </EmailText>
    <EmailText>
      {{ beforeDownload
      }}<Link :href="DOWNLOAD_URL" :style="styles.link">{{ t.invitationDownloadLink }}</Link
      >{{ afterDownload }}
    </EmailText>
    <template #signature>
      {{ t.invitationSignatureName }}<br />
      {{ t.invitationSignatureRole }}
    </template>
  </BrandEmail>
</template>
