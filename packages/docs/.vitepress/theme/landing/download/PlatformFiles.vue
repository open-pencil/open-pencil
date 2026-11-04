<script setup lang="ts">
import { useData } from 'vitepress'
import IconApple from '~icons/simple-icons/apple'
import IconLinux from '~icons/simple-icons/linux'
import IconWindows from '~icons/simple-icons/windows'

import { useLandingMessages } from '../content/messages'
import { archLabel, extension, formatSize, PLATFORM_NAMES } from './format'
import { filesFor, PLATFORMS, type Platform, type Release } from './releases'

/**
 * Every installer of a release, a column per platform. `compact` leaves out what each format is
 * for, as the beta lists its files under the stable release's.
 */
const {
  release,
  current = null,
  compact = false
} = defineProps<{
  release: Release
  current?: Platform | null
  compact?: boolean
}>()

const messages = useLandingMessages()
const { lang } = useData()

const ICONS = { mac: IconApple, windows: IconWindows, linux: IconLinux }
</script>

<template>
  <div class="platforms" :data-compact="compact || undefined">
    <div v-for="platform in PLATFORMS" :key="platform" class="platform">
      <h3>
        <component :is="ICONS[platform]" class="mark" aria-hidden="true" />
        {{ PLATFORM_NAMES[platform] }}
        <span v-if="platform === current" class="yours">{{ messages.download.yourSystem }}</span>
      </h3>
      <ul>
        <li v-for="file in filesFor(release, platform)" :key="file.name">
          <a :href="file.url">
            <span class="name">
              {{ archLabel(messages.download, file.platform, file.arch) }}
              <span class="ext">{{ extension(file.format) }}</span>
            </span>
            <span class="size">{{ formatSize(file.size, lang) }}</span>
            <span v-if="!compact" class="purpose">{{
              messages.download.formats[file.format]
            }}</span>
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.platforms {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 48px;
  margin-top: 40px;
}

h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 16px;
  font-weight: 600;
}

.mark {
  width: 16px;
  height: 16px;
  color: var(--vp-c-text-1);
}

.yours {
  margin-left: auto;
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 500;
}

a {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.name {
  font-size: 14px;
  font-weight: 500;
  transition: color 0.2s;
}

a:hover .name {
  color: var(--vp-c-brand-1);
}

.ext {
  margin-left: 2px;
  color: var(--vp-c-text-2);
  font-weight: 400;
}

.size {
  color: var(--vp-c-text-2);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.purpose {
  grid-column: 1 / -1;
  margin-top: 2px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.platforms[data-compact] {
  margin-top: 8px;
}

@media (max-width: 860px) {
  .platforms {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
}
</style>
