<script setup lang="ts">
import { useData } from 'vitepress'
import { VPImage, VPLink, useLayout } from 'vitepress/theme'
import { computed } from 'vue'

import { fill } from '../landing/content/messages/fill'
import { footerColumns } from './links'
import { SITE_MESSAGES } from './messages'

/**
 * The site's foot on pages without a sidebar, as VitePress shows its own: the product's line,
 * link columns, and the copyright with the license, in the page's locale.
 */
const { theme, frontmatter, localeIndex } = useData()
const { hasSidebar } = useLayout()
const messages = computed(
  () => SITE_MESSAGES[localeIndex.value as keyof typeof SITE_MESSAGES] ?? SITE_MESSAGES.root
)
const columns = computed(() => footerColumns(messages.value, localeIndex.value))
const home = computed(() => (localeIndex.value === 'root' ? '/' : `/${localeIndex.value}/`))
const year = new Date().getFullYear()
</script>

<template>
  <footer v-if="!hasSidebar && frontmatter.footer !== false" class="site-footer">
    <div class="inner">
      <div class="brand">
        <VPLink :href="home" class="name">
          <VPImage :image="theme.logo" class="mark" />
          OpenPencil
        </VPLink>
        <p class="tagline">{{ messages.tagline }}</p>
      </div>
      <nav v-for="column in columns" :key="column.title" class="column" :aria-label="column.title">
        <h2>{{ column.title }}</h2>
        <VPLink v-for="link in column.links" :key="link.href" :href="link.href" class="link">
          {{ link.label }}
        </VPLink>
      </nav>
      <div class="bottom">
        <span>{{ fill(messages.copyright, { year }) }}</span>
        <span>{{ messages.license }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  position: relative;
  z-index: var(--vp-z-index-footer);
  border-top: 1px solid var(--vp-c-divider);
  background-color: var(--vp-c-bg);
}

.inner {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(3, minmax(0, 1fr));
  gap: 40px 32px;
  max-width: 1152px;
  margin: 0 auto;
  padding: 48px 24px 32px;
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.name {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--vp-c-text-1);
  font-size: 16px;
  font-weight: 600;
}

.name :deep(.mark) {
  width: 24px;
  height: 24px;
}

.tagline {
  max-width: 320px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.5;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.column h2 {
  margin-bottom: 4px;
  color: var(--vp-c-text-1);
  font-size: 12px;
  font-weight: 600;
}

.link {
  width: fit-content;
  color: var(--vp-c-text-2);
  font-size: 14px;
  transition: color 0.25s;
}

.link:hover {
  color: var(--vp-c-text-1);
}

.bottom {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: 8px;
  justify-content: space-between;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 12px;
}

@media (max-width: 768px) {
  .inner {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding-inline: 16px;
  }

  .brand {
    grid-column: 1 / -1;
  }
}
</style>
