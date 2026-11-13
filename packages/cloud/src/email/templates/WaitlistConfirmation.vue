<script setup lang="ts">
import { Link } from '@vue-email/components'

import { styles } from './brand'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { useEmailLocalization } from './localization'

/** Asks a waitlist sign-up to confirm its address; its links carry the sign-up's token only. */
const { confirmURL, leaveURL } = defineProps<{ confirmURL: string; leaveURL: string }>()

const { t } = useEmailLocalization()
// The translation places the link inside its sentence, where `{link}` is.
const [beforeLink = '', afterLink = ''] = t.waitlistNote.split('{link}')
</script>

<template>
  <BrandEmail
    :preview="t.waitlistPreview"
    :heading="t.waitlistHeading"
    :action="{ label: t.waitlistAction, url: confirmURL }"
  >
    <EmailText>{{ t.waitlist }}</EmailText>
    <template #note>
      {{ beforeLink }}<Link :href="leaveURL" :style="styles.link">{{ t.waitlistLeave }}</Link
      >{{ afterLink }}
    </template>
  </BrandEmail>
</template>
