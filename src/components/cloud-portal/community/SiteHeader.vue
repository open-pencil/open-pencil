<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { CLOUD_COMMUNITY_PATH } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import BrandMark from '@/components/brand/BrandMark.vue'
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import { useAppButtonUI } from '@/components/ui/button/button'
import { DESKTOP_DOWNLOAD_URL, DOCS_URL, REPOSITORY_URL } from '@/constants'
import siteTheme from '@/theme/cloud-portal/site'

/**
 * The bar over the server's public pages. The official server is OpenPencil's own site, as
 * openpencil.dev: its name, the gallery, docs, download, and GitHub. A self-hosted server is its
 * operator's: their name and logo, the gallery, and their help, as GitLab and Mastodon instances
 * keep the vendor's links off theirs. Both end in signing in and the editor, or the account.
 */
const site = tv(siteTheme)
const ui = site()
const portal = usePortal()
const route = useRoute()
const messages = useCloudPortalMessages()
const signInButton = useAppButtonUI({ variant: 'ghost', size: 'md', shape: 'pill' })
const editorButton = useAppButtonUI({
  color: 'primary',
  variant: 'solid',
  size: 'md',
  shape: 'pill'
})
const official = portal.discovery.deployment === 'official'
const branding = portal.discovery.branding
const name = official ? 'OpenPencil' : (branding?.name ?? portal.host)
const helpURL = official ? DOCS_URL : (branding?.helpURL ?? DOCS_URL)
const user = computed(() => portal.account.value?.user ?? null)
const signInPath = computed(() => `/auth/sign-in?redirect=${encodeURIComponent(route.fullPath)}`)
const onCommunity = computed(() => route.path.startsWith(CLOUD_COMMUNITY_PATH))
</script>

<template>
  <header :class="ui.header()">
    <div :class="ui.headerInner()">
      <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.brand()">
        <img
          v-if="!official && branding?.logoURL"
          :src="branding.logoURL"
          alt=""
          :class="ui.brandLogo()"
        />
        <BrandMark v-else variant="mark" decorative :class="ui.brandMark()" />
        <span :class="ui.brandName()">{{ name }}</span>
      </RouterLink>
      <nav :class="ui.nav()" :aria-label="name">
        <RouterLink
          v-if="portal.discovery.community"
          :to="CLOUD_COMMUNITY_PATH"
          :class="ui.navLink()"
          :aria-current="onCommunity ? 'page' : undefined"
        >
          {{ messages.communityTitle }}
        </RouterLink>
        <a :href="helpURL" target="_blank" rel="noreferrer" :class="ui.navLink()">
          {{ official ? messages.siteDocs : messages.help }}
        </a>
        <a
          v-if="official"
          :href="DESKTOP_DOWNLOAD_URL"
          target="_blank"
          rel="noreferrer"
          :class="ui.navLink()"
        >
          {{ messages.siteDownload }}
        </a>
      </nav>
      <div :class="ui.actions()">
        <a
          v-if="official"
          :href="REPOSITORY_URL"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
          :class="ui.iconLink()"
        >
          <icon-lucide-github class="size-4" />
        </a>
        <RouterLink v-if="!user" :to="signInPath" :class="signInButton.base">
          {{ messages.signIn }}
        </RouterLink>
        <a href="/" :class="editorButton.base">{{ messages.openEditor }}</a>
        <AccountAvatar v-if="user" :id="user.userId" :name="user.name" :image="user.image" />
      </div>
    </div>
  </header>
</template>
