<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { useSiteIdentity, type SiteLinkTarget } from '@/app/cloud-portal/identity'
import BrandMark from '@/components/brand/BrandMark.vue'
import PortalLanguageSelect from '@/components/cloud-portal/layout/PortalLanguageSelect.vue'
import { DOCS_URL, REPOSITORY_URL } from '@/constants'

import SiteLink from './SiteLink.vue'
import { siteCompactFooter } from './ui'

/**
 * A self-hosted site's footer, as Mastodon's: the operator's name, help, and legal links, then
 * what the server runs, its docs and source, and the language.
 */
const site = useSiteIdentity()
const messages = useCloudPortalMessages()
const ui = siteCompactFooter()

const operatorLinks = computed<SiteLinkTarget[]>(() => [
  ...(site.ownHelp ? [{ label: messages.value.help, href: site.helpURL, external: true }] : []),
  ...site.legalLinks.value
])
</script>

<template>
  <footer :class="ui.root()">
    <div :class="ui.inner()">
      <nav :class="ui.line()" :aria-label="site.name">
        <span :class="ui.operator()">{{ site.name }}</span>
        <SiteLink
          v-for="link in operatorLinks"
          :key="link.href"
          :href="link.href"
          :external="link.external"
        >
          {{ link.label }}
        </SiteLink>
      </nav>
      <nav :class="ui.line()" aria-label="OpenPencil">
        <SiteLink :href="DOCS_URL" external>
          <span :class="ui.poweredBy()">
            <BrandMark variant="micro" decorative :class="ui.poweredMark()" />
            {{ messages.sitePoweredBy }}
          </span>
        </SiteLink>
        <SiteLink :href="DOCS_URL" external>{{ messages.siteDocs }}</SiteLink>
        <SiteLink :href="REPOSITORY_URL" external>{{ messages.siteSourceCode }}</SiteLink>
        <PortalLanguageSelect />
      </nav>
    </div>
  </footer>
</template>
