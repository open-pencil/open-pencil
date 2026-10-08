<script setup lang="ts">
import IconBookOpen from '~icons/lucide/book-open'
import IconCloud from '~icons/lucide/cloud'
import IconDownload from '~icons/lucide/download'

import { LINKS } from '../content/links'
import { useLandingMessages, useLocalePath } from '../content/messages'
import ActionButton from '../ui/ActionButton.vue'

const messages = useLandingMessages()
const localePath = useLocalePath()
</script>

<template>
  <section class="landing-section">
    <h2>{{ messages.closing.title }}</h2>
    <div class="landing-actions">
      <ActionButton :href="LINKS.download" :icon="IconDownload" primary>
        {{ messages.closing.download }}
      </ActionButton>
      <ActionButton :href="localePath(LINKS.docs)" :icon="IconBookOpen">
        {{ messages.closing.docs }}
      </ActionButton>
      <ActionButton href="#cloud" :icon="IconCloud">{{ messages.closing.cloud }}</ActionButton>
    </div>
  </section>
</template>
