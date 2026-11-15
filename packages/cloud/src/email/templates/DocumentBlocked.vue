<script setup lang="ts">
import { Link } from '@vue-email/components'

import type { DocumentBlockedPayload } from '../schema'
import { styles } from './brand'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/**
 * To a workspace's owner: an administrator took one of its documents down. It says why, when the
 * administrator gave a reason, and where to contest it.
 */
const { payload } = defineProps<{ payload: DocumentBlockedPayload }>()

const localization = useEmailLocalization()
const { t } = localization
const document = { document: payload.documentName }
// The translation places the address inside its sentence, where `{email}` is.
const [beforeEmail = '', afterEmail = ''] = t
  .documentBlockedContest({ email: '{email}' })
  .split('{email}')
</script>

<template>
  <BrandEmail
    :preview="t.documentBlocked(document)"
    :heading="t.documentBlockedHeading"
    :action="{ label: t.openHome, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ t.documentBlocked(document) }}</EmailText>
    <EmailText v-if="payload.reason">
      {{ t.documentBlockedReason({ reason: payload.reason }) }}
    </EmailText>
    <EmailText v-if="payload.contactEmail">
      {{ beforeEmail
      }}<Link :href="`mailto:${payload.contactEmail}`" :style="styles.link">{{
        payload.contactEmail
      }}</Link
      >{{ afterEmail }}
    </EmailText>
    <EmailText v-else>{{ t.documentBlockedContestAdministrators }}</EmailText>
  </BrandEmail>
</template>
