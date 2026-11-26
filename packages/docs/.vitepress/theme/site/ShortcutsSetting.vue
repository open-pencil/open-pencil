<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

import { useKeyPlatformChoice } from '../guide/keys'
import { SITE_MESSAGES } from './messages'

/** The site's shortcut setting, at the end of the sidebar. */
const choice = useKeyPlatformChoice()
const { localeIndex } = useData()
const messages = computed(
  () => SITE_MESSAGES[localeIndex.value as keyof typeof SITE_MESSAGES] ?? SITE_MESSAGES.root
)
</script>

<template>
  <label class="shortcuts">
    <span>{{ messages.shortcuts }}</span>
    <select v-model="choice">
      <option value="">{{ messages.automatic }}</option>
      <option value="mac">Mac</option>
      <option value="other">Windows, Linux</option>
    </select>
  </label>
</template>

<style scoped>
.shortcuts {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 13px;
}

select {
  padding: 2px 4px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--vp-c-text-2);
  font: inherit;
  text-align: end;
  text-align-last: end;
  cursor: pointer;
}

select:hover {
  color: var(--vp-c-text-1);
}

select:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
}

option {
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
}
</style>
