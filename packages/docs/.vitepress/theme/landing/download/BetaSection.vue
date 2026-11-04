<script setup lang="ts">
import { useData } from 'vitepress'

import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'

import { useLandingMessages } from '../content/messages'
import { versionLine } from './format'
import PlatformFiles from './PlatformFiles.vue'
import type { Platform, Release } from './releases'

/** The newest beta: what it is, what to know first, its files, and what it adds. */
const { release, current = null } = defineProps<{
  release: Release
  current?: Platform | null
}>()

const messages = useLandingMessages()
const { lang } = useData()
</script>

<template>
  <section class="landing-section">
    <div class="beta">
      <div class="about">
        <span class="landing-badge">{{ messages.download.beta.badge }}</span>
        <h2 class="landing-heading">{{ messages.download.beta.title }}</h2>
        <p class="lede">{{ messages.download.beta.lede }}</p>
        <p class="version">{{ versionLine(messages.download, release, lang) }}</p>
        <ul class="caveats">
          <li v-for="caveat in messages.download.beta.caveats" :key="caveat">{{ caveat }}</li>
        </ul>
      </div>
      <div class="files">
        <PlatformFiles :release="release" :current="current" compact />
        <AppCollapsible
          class="notes"
          :label="messages.download.beta.notes"
          :ui="{
            trigger: 'py-3 text-sm font-medium text-(--vp-c-brand-1)',
            icon: 'size-4'
          }"
        >
          <!-- The release notes, rendered from the changelog section when the site was built. -->
          <div class="notes-body vp-doc" v-html="release.notes" />
        </AppCollapsible>
      </div>
    </div>
  </section>
</template>

<style scoped>
.beta {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 56px;
  align-items: start;
}

.lede {
  margin-top: 16px;
  color: var(--vp-c-text-2);
  font-size: 16px;
  line-height: 1.6;
}

.version {
  margin-top: 12px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.caveats {
  display: grid;
  gap: 8px;
  margin-top: 20px;
  color: var(--vp-c-text-2);
  font-size: 13px;
  line-height: 1.55;
}

.caveats li {
  position: relative;
  padding-left: 14px;
}

.caveats li::before {
  position: absolute;
  top: 0.62em;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--vp-c-text-3);
  content: '';
}

.notes {
  margin-top: 24px;
}

/* Inside the collapsible's animated wrapper, so its padding cannot snap while it opens. */
.notes-body {
  max-height: 480px;
  margin-top: 4px;
  padding: 4px 28px 24px;
  overflow-y: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  font-size: 14px;
  line-height: 1.65;
}

.notes-body.vp-doc :deep(h3) {
  margin: 24px 0 8px;
  padding-top: 0;
  border-top: 0;
  font-size: 15px;
  line-height: 1.4;
}

.notes-body.vp-doc :deep(p),
.notes-body.vp-doc :deep(li) {
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.65;
}

.notes-body.vp-doc :deep(p:first-child) {
  margin-top: 20px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.notes-body.vp-doc :deep(ul) {
  margin: 8px 0;
}

.notes-body.vp-doc :deep(li + li) {
  margin-top: 6px;
}

@media (max-width: 860px) {
  .beta {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
</style>
