<script setup lang="ts">
import IconBookOpen from '~icons/lucide/book-open'
import IconDownload from '~icons/lucide/download'

import { LINKS } from '../content/links'
import { useLandingMessages, useLocalePath } from '../content/messages'
import ActionLink from '../ui/ActionLink.vue'

const messages = useLandingMessages()
const localePath = useLocalePath()
</script>

<template>
  <section class="landing-section">
    <h2>{{ messages.closing.title }}</h2>
    <div class="landing-actions">
      <ActionLink :href="LINKS.download" :icon="IconDownload" primary>
        {{ messages.closing.download }}
      </ActionLink>
      <ActionLink :href="localePath(LINKS.docs)" :icon="IconBookOpen">
        {{ messages.closing.docs }}
      </ActionLink>
    </div>
  </section>
</template>
