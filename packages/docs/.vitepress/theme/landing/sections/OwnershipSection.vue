<script setup lang="ts">
import IconCloud from '~icons/lucide/cloud'
import IconFileOutput from '~icons/lucide/file-output'
import IconHardDrive from '~icons/lucide/hard-drive'
import IconScale from '~icons/lucide/scale'

import { useLandingMessages } from '../content/messages'

const messages = useLandingMessages()

/** One per item, in the order every locale lists them: local, storage, formats, license. */
const ICONS = [IconHardDrive, IconCloud, IconFileOutput, IconScale]
</script>

<template>
  <section class="landing-section">
    <h2>{{ messages.ownership.title }}</h2>
    <dl class="landing-facts">
      <div v-for="(item, index) in messages.ownership.items" :key="item.title">
        <component :is="ICONS[index]" class="icon" aria-hidden="true" />
        <dt>{{ item.title }}</dt>
        <dd>{{ item.detail }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.icon {
  display: block;
  width: 24px;
  height: 24px;
  margin-bottom: 14px;
  color: var(--vp-c-brand-1);
}
</style>
