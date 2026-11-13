<script setup lang="ts">
import { Link } from '@vue-email/components'

import type { DocumentReportDecidedPayload } from '../schema'
import { styles } from './brand'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { useEmailLocalization } from './localization'

/** To whoever reported a document: what the administrators decided, and where to disagree. */
const { payload } = defineProps<{ payload: DocumentReportDecidedPayload }>()

const { t } = useEmailLocalization()
const document = { document: payload.documentName }
const decision = {
  blocked: { heading: t.reportBlockedHeading, message: t.reportBlocked(document) },
  actioned: { heading: t.reportActionedHeading, message: t.reportActioned(document) },
  dismissed: { heading: t.reportDismissedHeading, message: t.reportDismissed(document) }
}[payload.outcome]
// The translation places the address inside its sentence, where `{email}` is.
const [beforeEmail = '', afterEmail = ''] = t.reportDisagree({ email: '{email}' }).split('{email}')
</script>

<template>
  <BrandEmail :preview="decision.message" :heading="decision.heading">
    <EmailText>{{ decision.message }}</EmailText>
    <EmailText v-if="payload.contactEmail">
      {{ beforeEmail
      }}<Link :href="`mailto:${payload.contactEmail}`" :style="styles.link">{{
        payload.contactEmail
      }}</Link
      >{{ afterEmail }}
    </EmailText>
    <EmailText v-else>{{ t.reportDisagreeAdministrators }}</EmailText>
  </BrandEmail>
</template>
