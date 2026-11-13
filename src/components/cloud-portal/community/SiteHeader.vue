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
import { DOCS_URL, REPOSITORY_URL } from '@/constants'
import siteTheme from '@/theme/cloud-portal/site'

/**
 * The bar over the server's public pages, as openpencil.dev's: the mark and name, the gallery and
 * the docs, then GitHub, signing in, and the editor, or the account once signed in.
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
const user = computed(() => portal.account.value?.user ?? null)
const signInPath = computed(() => `/auth/sign-in?redirect=${encodeURIComponent(route.fullPath)}`)
const onCommunity = computed(() => route.path.startsWith(CLOUD_COMMUNITY_PATH))
</script>

<template>
  <header :class="ui.header()">
    <div :class="ui.headerInner()">
      <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.brand()">
        <BrandMark variant="mark" decorative :class="ui.brandMark()" />
        <span :class="ui.brandName()">OpenPencil</span>
      </RouterLink>
      <nav :class="ui.nav()" :aria-label="messages.productName">
        <RouterLink
          :to="CLOUD_COMMUNITY_PATH"
          :class="ui.navLink()"
          :aria-current="onCommunity ? 'page' : undefined"
        >
          {{ messages.communityTitle }}
        </RouterLink>
        <a :href="DOCS_URL" target="_blank" rel="noreferrer" :class="ui.navLink()">
          {{ messages.siteDocs }}
        </a>
      </nav>
      <div :class="ui.actions()">
        <a
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
