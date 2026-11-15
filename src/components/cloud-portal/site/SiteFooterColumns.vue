<script setup lang="ts">
import { computed } from 'vue'

import { CLOUD_COMMUNITY_PATH } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { useSiteIdentity, type SiteLinkTarget } from '@/app/cloud-portal/identity'
import PortalLanguageSelect from '@/components/cloud-portal/layout/PortalLanguageSelect.vue'
import {
  CLOUD_DOCS_URL,
  COMMUNITY_URL,
  DESKTOP_DOWNLOAD_URL,
  DOCS_URL,
  REPOSITORY_URL
} from '@/constants'

import SiteBrand from './SiteBrand.vue'
import SiteLink from './SiteLink.vue'
import { siteFooter } from './ui'

/**
 * The official site's footer, as openpencil.dev's: the product's line, its links in columns, the
 * legal links, and the copyright with the license and the language.
 */
const portal = usePortal()
const site = useSiteIdentity()
const messages = useCloudPortalMessages()
const ui = siteFooter()
const year = new Date().getFullYear()

const columns = computed<Array<{ title: string; links: SiteLinkTarget[] }>>(() => [
  {
    title: messages.value.siteProduct,
    links: [
      { label: messages.value.openEditor, href: '/', external: false },
      ...(portal.discovery.community
        ? [{ label: messages.value.communityTitle, href: CLOUD_COMMUNITY_PATH }]
        : []),
      { label: messages.value.siteDownload, href: DESKTOP_DOWNLOAD_URL, external: true }
    ]
  },
  {
    title: messages.value.siteResources,
    links: [
      { label: messages.value.siteDocs, href: DOCS_URL, external: true },
      { label: messages.value.siteCloudDocs, href: CLOUD_DOCS_URL, external: true },
      { label: 'GitHub', href: REPOSITORY_URL, external: true },
      { label: 'Discord', href: COMMUNITY_URL, external: true }
    ]
  },
  ...(site.legalLinks.value.length > 0
    ? [{ title: messages.value.siteLegal, links: site.legalLinks.value }]
    : [])
])
</script>

<template>
  <footer :class="ui.root()">
    <div :class="ui.inner()">
      <div :class="ui.about()">
        <SiteBrand />
        <p :class="ui.tagline()">{{ messages.siteTagline }}</p>
      </div>
      <nav
        v-for="column in columns"
        :key="column.title"
        :class="ui.column()"
        :aria-label="column.title"
      >
        <h2 :class="ui.columnTitle()">{{ column.title }}</h2>
        <div :class="ui.columnLinks()">
          <SiteLink
            v-for="link in column.links"
            :key="link.href"
            :href="link.href"
            :external="link.external"
          >
            {{ link.label }}
          </SiteLink>
        </div>
      </nav>
      <div :class="ui.bottom()">
        <span>{{ messages.siteCopyright({ year }) }}</span>
        <span :class="ui.bottomEnd()">
          {{ messages.siteLicense }}
          <PortalLanguageSelect />
        </span>
      </div>
    </div>
  </footer>
</template>
