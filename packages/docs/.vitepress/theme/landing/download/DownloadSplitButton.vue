<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { useData } from 'vitepress'
import IconCheck from '~icons/lucide/check'
import IconChevronDown from '~icons/lucide/chevron-down'
import IconDownload from '~icons/lucide/download'

import { menuItem, useMenuUI } from '@/components/ui/menu/menu'

import { useLandingMessages } from '../content/messages'
import { fill } from '../content/messages/fill'
import { archLabel, extension, formatSize, PLATFORM_NAMES } from './format'
import type { ReleaseFile } from './releases'

/**
 * One click for the likely installer, and a menu of every installer for the same platform, such
 * as the Intel disk image or the `.msi`, each a direct download.
 */
const { main, files } = defineProps<{ main: ReleaseFile; files: ReleaseFile[] }>()

const messages = useLandingMessages()
const { lang } = useData()
const menu = useMenuUI({ content: 'min-w-60' })
const item = menuItem({ justify: 'start', class: 'gap-2.5' })
</script>

<template>
  <div class="split">
    <a class="main" :href="main.url">
      <IconDownload aria-hidden="true" />
      {{ fill(messages.download.forPlatform, { platform: PLATFORM_NAMES[main.platform] }) }}
    </a>
    <DropdownMenuRoot v-if="files.length > 1">
      <DropdownMenuTrigger
        class="more"
        :aria-label="fill(messages.download.moreFiles, { platform: PLATFORM_NAMES[main.platform] })"
      >
        <IconChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent side="bottom" align="end" :side-offset="6" :class="menu.content">
          <DropdownMenuItem v-for="file in files" :key="file.name" as-child :class="item">
            <a :href="file.url">
              <IconCheck
                :class="[menu.icon, file.name === main.name ? '' : 'invisible']"
                aria-hidden="true"
              />
              <span class="flex-1">
                {{ archLabel(messages.download, file.platform, file.arch) }}
                <span class="text-muted">{{ extension(file.format) }}</span>
              </span>
              <span :class="menu.shortcut">{{ formatSize(file.size, lang) }}</span>
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<style scoped>
/* The landing's primary action, split into the download and the menu of the others. */
.split {
  display: inline-flex;
  height: 40px;
  border: 1px solid var(--vp-button-brand-border);
  border-radius: 20px;
  background-color: var(--vp-button-brand-bg);
  color: var(--vp-button-brand-text);
  overflow: hidden;
}

.main,
.more {
  display: inline-flex;
  align-items: center;
  color: inherit;
  transition: background-color 0.25s;
}

.main {
  gap: 8px;
  padding: 0 18px 0 16px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.more {
  justify-content: center;
  width: 40px;
  border-left: 1px solid rgb(255 255 255 / 0.25);
}

/* The rounded clip would cut an outside focus ring, so it is drawn inside. */
.main:focus-visible,
.more:focus-visible {
  outline: 2px solid var(--vp-button-brand-text);
  outline-offset: -4px;
}

.main:hover,
.more:hover,
.more[data-state='open'] {
  background-color: var(--vp-button-brand-hover-bg);
}

svg {
  flex: none;
  width: 16px;
  height: 16px;
}
</style>
