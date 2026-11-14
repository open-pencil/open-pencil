<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { CLOUD_COMMUNITY_PATH } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { useSiteIdentity } from '@/app/cloud-portal/identity'
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import { useAppButtonUI } from '@/components/ui/button/button'
import { DESKTOP_DOWNLOAD_URL, REPOSITORY_URL } from '@/constants'

import SiteBrand from './SiteBrand.vue'
import SiteLink from './SiteLink.vue'
import { siteHeader } from './ui'

/**
 * The bar over the site's pages. The official server is OpenPencil's own site, as openpencil.dev:
 * the gallery, docs, download, and GitHub. A self-hosted server is its operator's: the gallery
 * and their help, as GitLab and Mastodon instances keep the vendor's links off theirs. Both end in
 * signing in and the editor, or the account.
 */
const portal = usePortal()
const site = useSiteIdentity()
const route = useRoute()
const messages = useCloudPortalMessages()
const ui = siteHeader()
const signInButton = useAppButtonUI({ variant: 'ghost', size: 'md', shape: 'pill' })
const editorButton = useAppButtonUI({
  color: 'primary',
  variant: 'solid',
  size: 'md',
  shape: 'pill'
})
const user = computed(() => portal.account.value?.user ?? null)
const signInPath = computed(() => `/auth/sign-in?redirect=${encodeURIComponent(route.fullPath)}`)
const onCommunity = computed(() => route.path.startsWith(CLOUD_COMMUNITY_PATH))
</script>

<template>
  <header :class="ui.root()">
    <div :class="ui.inner()">
      <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.home()">
        <SiteBrand />
      </RouterLink>
      <nav :class="ui.nav()" :aria-label="site.name">
        <SiteLink
          v-if="portal.discovery.community"
          :href="CLOUD_COMMUNITY_PATH"
          place="nav"
          :current="onCommunity"
        >
          {{ messages.communityTitle }}
        </SiteLink>
        <SiteLink :href="site.helpURL" external place="nav">
          {{ site.official ? messages.siteDocs : messages.help }}
        </SiteLink>
        <SiteLink v-if="site.official" :href="DESKTOP_DOWNLOAD_URL" external place="nav">
          {{ messages.siteDownload }}
        </SiteLink>
      </nav>
      <div :class="ui.actions()">
        <a
          v-if="site.official"
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
