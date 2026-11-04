<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'
import IconArrowDown from '~icons/lucide/arrow-down'
import IconGithub from '~icons/lucide/github'

import { LINKS } from '../content/links'
import { useLandingMessages, useLocalePath } from '../content/messages'
import ActionButton from '../ui/ActionButton.vue'
import StageFrame from '../ui/StageFrame.vue'
import DownloadSplitButton from './DownloadSplitButton.vue'
import { archLabel, formatSize, versionLine } from './format'
import { filesFor, type Release, type ReleaseFile } from './releases'
import type { VisitorSystem } from './visitor'

const { release, system } = defineProps<{
  release: Release | null
  system: VisitorSystem | null
}>()

const messages = useLandingMessages()
const localePath = useLocalePath()
const { lang } = useData()

/**
 * The installer for the visitor's system, and every installer for that platform. A Mac whose
 * browser does not say gets Apple Silicon, which every Mac since late 2020 has; the menu beside
 * the button has Intel.
 */
const choice = computed<{ main: ReleaseFile; files: ReleaseFile[] } | null>(() => {
  const platform = system?.platform
  if (!release || !platform) return null
  const files = filesFor(release, platform)
  const arch = system?.arch ?? (platform === 'mac' ? 'arm64' : 'x64')
  const main = files.find((file) => file.arch === arch) ?? files[0]
  return main ? { main, files } : null
})
</script>

<template>
  <section class="download-hero">
    <div class="copy">
      <h1>{{ messages.download.title }}</h1>
      <p class="lede">{{ messages.download.lede }}</p>

      <template v-if="release">
        <!-- Keeps its height until the browser says which system it runs on. -->
        <div class="pick">
          <template v-if="choice">
            <div class="landing-actions">
              <DownloadSplitButton :main="choice.main" :files="choice.files" />
            </div>
            <p class="meta">
              {{ archLabel(messages.download, choice.main.platform, choice.main.arch) }} ·
              {{ messages.download.formats[choice.main.format] }} ·
              {{ formatSize(choice.main.size, lang) }}
            </p>
          </template>
          <!-- A phone, a tablet, or a system the browser does not name: the list has them all. -->
          <div v-else-if="system" class="landing-actions">
            <ActionButton href="#all" :icon="IconArrowDown" primary>
              {{ messages.download.allTitle }}
            </ActionButton>
          </div>
        </div>
        <p class="version">
          {{ versionLine(messages.download, release, lang) }}
          <span class="links">
            <a :href="release.url">{{ messages.download.releaseNotes }}</a>
            <a :href="localePath('/getting-started') + '#system-requirements'">{{
              messages.download.requirements
            }}</a>
          </span>
        </p>
      </template>

      <template v-else>
        <p class="version">{{ messages.download.unavailable }}</p>
        <div class="landing-actions">
          <ActionButton :href="LINKS.download" :icon="IconGithub" primary>
            {{ messages.download.onGitHub }}
          </ActionButton>
        </div>
      </template>
    </div>

    <div class="stage">
      <StageFrame kind="interactive" />
    </div>
  </section>
</template>

<style scoped>
.download-hero {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  gap: 56px;
  align-items: center;
  padding-top: 72px;
}

h1 {
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.lede {
  margin-top: 20px;
  color: var(--vp-c-text-2);
  font-size: 17px;
  line-height: 1.6;
}

.pick {
  min-height: 98px;
}

.meta {
  margin-top: 12px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.version {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 8px;
  padding-top: 20px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.links {
  display: flex;
  gap: 16px;
}

a {
  color: var(--vp-c-brand-1);
  font-weight: 500;
  text-decoration: none;
}

.stage {
  height: 460px;
}

@media (max-width: 860px) {
  .download-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
    padding-top: 40px;
  }

  .stage {
    height: 520px;
  }
}
</style>
