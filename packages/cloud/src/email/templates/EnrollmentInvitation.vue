<script setup lang="ts">
import { Link } from '@vue-email/components'

import type { EnrollmentEmailPayload } from '../schema'
import { BUG_REPORT_URL, DESKTOP_BETA_URL, styles } from './brand'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/**
 * A letter from OpenPencil's founder to someone who asked for the official Cloud before it opened:
 * thanks for waiting, it is a beta, and where to say what breaks. Replies reach a person, through
 * the deployment's reply address.
 */
const { payload } = defineProps<{ payload: EnrollmentEmailPayload }>()

const localization = useEmailLocalization()
const { t } = localization
// Each translation places its link inside the sentence, where `{link}` is.
const [beforeIssue = '', afterIssue = ''] = t.invitationBeta.split('{link}')
const [beforeDownload = '', afterDownload = ''] = t.invitationDesktop.split('{link}')
</script>

<template>
  <BrandEmail
    :preview="t.invitationPreview"
    :heading="t.invitationHeading"
    :action="{ label: t.invitationAction, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ t.invitationThanks }}</EmailText>
    <EmailText>
      {{ beforeIssue
      }}<Link :href="BUG_REPORT_URL" :style="styles.link">{{ t.invitationIssueLink }}</Link
      >{{ afterIssue }}
    </EmailText>
    <EmailText>
      {{ beforeDownload
      }}<Link :href="DESKTOP_BETA_URL" :style="styles.link">{{ t.invitationDownloadLink }}</Link
      >{{ afterDownload }}
    </EmailText>
    <template #signature>
      {{ t.invitationSignatureName }}<br />
      {{ t.invitationSignatureRole }}
    </template>
  </BrandEmail>
</template>
