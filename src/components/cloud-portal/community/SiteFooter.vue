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
 * The foot of the server's public pages. The official server's is OpenPencil's site footer: the
 * product's line, its links in columns, its legal links, and the copyright with the license. A
 * self-hosted server's is two lines, as Mastodon's: the operator's own links, then what it runs.
 */
type FooterLink = { label: string; href: string; external?: boolean }

const site = tv(siteTheme)
const ui = site()
const portal = usePortal()
const messages = useCloudPortalMessages()
const legal = usePortalLegal()
const official = portal.discovery.deployment === 'official'
const operator = portal.discovery.branding?.name ?? portal.host
const year = new Date().getFullYear()

const legalLinks = computed<FooterLink[]>(() => [
  ...(legal?.termsURL
    ? [{ label: messages.value.termsOfService, href: legal.termsURL, external: true }]
    : []),
  ...(legal?.privacyURL
    ? [{ label: messages.value.privacyPolicy, href: legal.privacyURL, external: true }]
    : []),
  ...(legal?.abuseEmail
    ? [{ label: messages.value.reportAbuse, href: `mailto:${legal.abuseEmail}` }]
    : [])
])

const columns = computed(() => [
  {
    title: messages.value.siteProduct,
    links: [
      { label: messages.value.openEditor, href: '/' },
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
  ...(legalLinks.value.length > 0
    ? [{ title: messages.value.siteLegal, links: legalLinks.value }]
    : [])
])

const operatorLinks = computed<FooterLink[]>(() => [
  ...(portal.discovery.branding?.helpURL
    ? [{ label: messages.value.help, href: portal.discovery.branding.helpURL, external: true }]
    : []),
  ...legalLinks.value
])
</script>

<template>
  <footer v-if="official" :class="ui.footer()">
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
        <span>{{ messages.siteCopyright({ year }) }}</span>
        <span>{{ messages.siteLicense }}</span>
      </div>
    </div>
  </footer>
  <footer v-else :class="ui.footer()">
    <div :class="ui.compactFooter()">
      <nav :class="ui.compactLine()" :aria-label="operator">
        <span :class="ui.compactName()">{{ operator }}</span>
        <a
          v-for="link in operatorLinks"
          :key="link.href"
          :href="link.href"
          :target="link.external ? '_blank' : undefined"
          :rel="link.external ? 'noreferrer' : undefined"
          :class="ui.footerLink()"
        >
          {{ link.label }}
        </a>
      </nav>
      <nav :class="ui.compactLine()" aria-label="OpenPencil">
        <a :href="DOCS_URL" target="_blank" rel="noreferrer" :class="ui.poweredBy()">
          <BrandMark variant="micro" decorative :class="ui.poweredMark()" />
          {{ messages.sitePoweredBy }}
        </a>
        <a :href="DOCS_URL" target="_blank" rel="noreferrer" :class="ui.footerLink()">
          {{ messages.siteDocs }}
        </a>
        <a :href="REPOSITORY_URL" target="_blank" rel="noreferrer" :class="ui.footerLink()">
          {{ messages.siteSourceCode }}
        </a>
      </nav>
    </div>
  </footer>
</template>
