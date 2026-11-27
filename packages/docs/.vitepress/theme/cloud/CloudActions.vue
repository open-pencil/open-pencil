<script setup lang="ts">
import IconArrowRight from '~icons/lucide/arrow-right'
import IconTag from '~icons/lucide/tag'

import { LINKS } from '../landing/content/links'
import ActionButton from '../landing/ui/ActionButton.vue'
</script>

<template>
  <div class="actions">
    <ActionButton :href="LINKS.cloud" :icon="IconArrowRight" primary>Open Cloud</ActionButton>
    <ActionButton :href="LINKS.pricing" :icon="IconTag">See plans</ActionButton>
  </div>
  <p class="note">Free plan with 300 MB. Or <a href="/cloud/self-hosting/">self-host it</a>.</p>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.note {
  margin: 12px 0 0;
  color: var(--vp-c-text-2);
  font-size: 14px;
}
</style>
