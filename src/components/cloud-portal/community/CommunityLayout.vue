<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import { CLOUD_COMMUNITY_PATH } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import BrandMark from '@/components/brand/BrandMark.vue'
import PortalFooter from '@/components/cloud-portal/layout/PortalFooter.vue'
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import { useAppButtonUI } from '@/components/ui/button/button'
import portalLayoutTheme from '@/theme/cloud-portal/layout'

/**
 * A community gallery page under the console's bar: the server, then the editor and the account,
 * or signing in for a visitor without one; then the page and the public pages' foot.
 */
const portalLayout = tv(portalLayoutTheme)
const portal = usePortal()
const route = useRoute()
const ui = portalLayout()
const messages = useCloudPortalMessages()
const editorLink = useAppButtonUI({ variant: 'outline', size: 'sm' })
const signInLink = useAppButtonUI({ variant: 'ghost', size: 'sm' })
const user = computed(() => portal.account.value?.user ?? null)
const signInPath = computed(() => `/auth/sign-in?redirect=${encodeURIComponent(route.fullPath)}`)

// The page scrolls inside its own element, which the router's scroll handling never sees: moving to
// another file starts at the top.
const main = useTemplateRef<HTMLElement>('main')
watch(
  () => route.path,
  () => main.value?.scrollTo({ top: 0 })
)
</script>

<template>
  <div :class="ui.page()">
    <header :class="ui.bar()">
      <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.barHome()">
        <BrandMark variant="micro" decorative />
        <span :class="ui.barTitle()">{{ messages.communityTitle }}</span>
      </RouterLink>
      <span :class="ui.barHost()">{{ portal.host }}</span>
      <div :class="ui.barEnd()">
        <RouterLink v-if="!user" :to="signInPath" :class="signInLink.base">
          {{ messages.signIn }}
        </RouterLink>
        <a href="/" :class="editorLink.base">{{ messages.openEditor }}</a>
        <AccountAvatar v-if="user" :id="user.userId" :name="user.name" :image="user.image" />
      </div>
    </header>
    <main ref="main" :class="ui.main({ class: 'flex flex-col' })">
      <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">
        <slot />
      </div>
      <PortalFooter :host="portal.host" />
    </main>
  </div>
</template>
