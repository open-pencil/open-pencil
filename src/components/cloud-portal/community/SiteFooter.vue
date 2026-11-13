<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { CLOUD_COMMUNITY_PATH } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import BrandMark from '@/components/brand/BrandMark.vue'
import { usePortalLegal } from '@/components/cloud-portal/layout/legal'
import {
  CLOUD_DOCS_URL,
  COMMUNITY_URL,
  DESKTOP_DOWNLOAD_URL,
  DOCS_URL,
  REPOSITORY_URL
} from '@/constants'
import siteTheme from '@/theme/cloud-portal/site'

/**
 * The foot of the server's public pages: the product's name and line, its links in columns, the
 * operator's legal links when the server names them, and the server's address with the license.
 */
type FooterLink = { label: string; href: string; external?: boolean }

const site = tv(siteTheme)
const ui = site()
const portal = usePortal()
const messages = useCloudPortalMessages()
const legal = usePortalLegal()

const columns = computed(() => {
  const legalLinks: FooterLink[] = [
    ...(legal?.termsURL ? [{ label: messages.value.termsOfService, href: legal.termsURL }] : []),
    ...(legal?.privacyURL ? [{ label: messages.value.privacyPolicy, href: legal.privacyURL }] : []),
    ...(legal?.abuseEmail
      ? [{ label: messages.value.reportAbuse, href: `mailto:${legal.abuseEmail}` }]
      : [])
  ]
  return [
    {
      title: messages.value.siteProduct,
      links: [
        { label: messages.value.openEditor, href: '/' },
        { label: messages.value.communityTitle, href: CLOUD_COMMUNITY_PATH },
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
    ...(legalLinks.length > 0 ? [{ title: messages.value.siteLegal, links: legalLinks }] : [])
  ] satisfies Array<{ title: string; links: FooterLink[] }>
})
</script>

<template>
  <footer :class="ui.footer()">
    <div :class="ui.footerInner()">
      <div :class="ui.footerBrand()">
        <span class="flex items-center gap-2">
          <BrandMark variant="mark" decorative :class="ui.brandMark()" />
          <span :class="ui.brandName()">OpenPencil</span>
        </span>
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
          <a
            v-for="link in column.links"
            :key="link.href"
            :href="link.href"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noreferrer' : undefined"
            :class="ui.footerLink()"
          >
            {{ link.label }}
          </a>
        </div>
      </nav>
      <div :class="ui.footerBottom()">
        <span>{{ portal.host }}</span>
        <span>{{ messages.siteLicense }}</span>
      </div>
    </div>
  </footer>
</template>
