<script setup lang="ts">
import IconGithub from '~icons/lucide/github'

import { useLandingMessages } from '../content/messages'
import ActionButton from '../ui/ActionButton.vue'
import PlatformFiles from './PlatformFiles.vue'
import type { Platform, Release } from './releases'

/**
 * The rolling nightly: what it is, what to know first, and its files. Their links stay the same
 * from night to night, but the build changes after the site is built, so the commit, version,
 * and checksums are on GitHub.
 */
const { release, current = null } = defineProps<{
  release: Release
  current?: Platform | null
}>()

const messages = useLandingMessages()
</script>

<template>
  <section id="nightly" class="landing-section">
    <div class="nightly">
      <div class="about">
        <span class="landing-badge">{{ messages.download.nightly.badge }}</span>
        <h2 class="landing-heading">{{ messages.download.nightly.title }}</h2>
        <p class="lede">{{ messages.download.nightly.lede }}</p>
        <ul class="caveats">
          <li v-for="caveat in messages.download.nightly.caveats" :key="caveat">{{ caveat }}</li>
        </ul>
        <ActionButton class="github" :href="release.url" :icon="IconGithub" small>
          {{ messages.download.nightly.onGitHub }}
        </ActionButton>
      </div>
      <PlatformFiles :release="release" :current="current" compact />
    </div>
  </section>
</template>

<style scoped>
.nightly {
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

.github {
  margin-top: 24px;
}

@media (max-width: 860px) {
  .nightly {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
</style>
