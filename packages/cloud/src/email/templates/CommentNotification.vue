<script setup lang="ts">
import { Link } from '@vue-email/components'

import type { CommentNotificationPayload } from '../schema'
import { styles } from './brand'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { greeting, useEmailLocalization } from './localization'

/** To someone a comment names, or who takes part in its thread: who wrote what, and where. */
const { payload } = defineProps<{ payload: CommentNotificationPayload }>()

const localization = useEmailLocalization()
const { t } = localization
const words = {
  author: payload.authorName ?? t.commentSomeone,
  document: payload.documentName
}
const lead = payload.reason === 'mention' ? t.commentMention(words) : t.commentReply(words)
// The translation places the link inside its sentence, where `{link}` is.
const [beforeLink = '', afterLink = ''] = t.commentSettings.split('{link}')
</script>

<template>
  <BrandEmail
    :preview="payload.excerpt"
    :heading="payload.reason === 'mention' ? t.commentMentionHeading : t.commentReplyHeading"
    :action="{ label: t.openComment, url: payload.actionURL }"
  >
    <EmailText>{{ greeting(localization, payload.name) }}</EmailText>
    <EmailText>{{ lead }}</EmailText>
    <EmailText>“{{ payload.excerpt }}”</EmailText>
    <template #note>
      {{ beforeLink
      }}<Link :href="payload.settingsURL" :style="styles.link">{{ t.commentSettingsLink }}</Link
      >{{ afterLink }}
    </template>
  </BrandEmail>
</template>
