<script setup lang="ts">
import type { Component } from 'vue'

/**
 * VitePress's `VPButton` takes no icon, so this mirrors its look from the same theme variables.
 * With an `href` it is a link; without one it submits the form it sits in.
 */
const {
  href,
  icon,
  primary = false,
  disabled = false
} = defineProps<{
  href?: string
  icon: Component
  primary?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <a v-if="href" class="action" :href="href" :data-primary="primary || undefined">
    <component :is="icon" aria-hidden="true" />
    <slot />
  </a>
  <button
    v-else
    class="action"
    type="submit"
    :disabled="disabled"
    :data-primary="primary || undefined"
  >
    <component :is="icon" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 20px 0 16px;
  border: 1px solid var(--vp-button-alt-border);
  border-radius: 20px;
  background-color: var(--vp-button-alt-bg);
  color: var(--vp-button-alt-text);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition:
    color 0.25s,
    border-color 0.25s,
    background-color 0.25s;
}

.action:hover {
  border-color: var(--vp-button-alt-hover-border);
  background-color: var(--vp-button-alt-hover-bg);
  color: var(--vp-button-alt-hover-text);
}

.action[data-primary] {
  border-color: var(--vp-button-brand-border);
  background-color: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
}

.action[data-primary]:hover {
  border-color: var(--vp-button-brand-hover-border);
  background-color: var(--vp-button-brand-hover-bg);
  color: var(--vp-button-brand-hover-text);
}

.action:disabled {
  cursor: progress;
  opacity: 0.6;
}

.action svg {
  flex: none;
  width: 16px;
  height: 16px;
}
</style>
