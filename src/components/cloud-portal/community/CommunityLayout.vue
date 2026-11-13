<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { CLOUD_COMMUNITY_PATH } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import BrandMark from '@/components/brand/BrandMark.vue'
import PortalFooter from '@/components/cloud-portal/layout/PortalFooter.vue'
import { portalCommunity } from '@/components/cloud-portal/ui'
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import AppButton from '@/components/ui/button/AppButton.vue'

/**
 * A community gallery page: a bar that stays at the top with the server's mark, the gallery, and
 * the editor, or signing in for a visitor without an account; then the page and its foot.
 */
const portal = usePortal()
const router = useRouter()
const route = useRoute()
const ui = portalCommunity()
const messages = useCloudPortalMessages()
const user = computed(() => portal.account.value?.user ?? null)

// The page scrolls inside its own element, which the router's scroll handling never sees: moving to
// another file starts at the top.
const page = useTemplateRef<HTMLElement>('page')
watch(
  () => route.path,
  () => page.value?.scrollTo({ top: 0 })
)

function signIn() {
  void router.push({ name: 'sign-in', query: { redirect: route.fullPath } })
}

function openEditor() {
  globalThis.location.assign('/')
}
</script>

<template>
  <div ref="page" :class="ui.page()">
    <header :class="ui.bar()">
      <div :class="ui.barInner()">
        <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.brand()">
          <BrandMark variant="app-icon" decorative :class="ui.mark()" />
          {{ messages.productName }}
        </RouterLink>
        <span :class="ui.barDivider()" aria-hidden="true" />
        <RouterLink :to="CLOUD_COMMUNITY_PATH" :class="ui.barSection()">
          {{ messages.communityTitle }}
        </RouterLink>
        <div :class="ui.barActions()">
          <AppButton v-if="!user" size="sm" variant="ghost" @click="signIn">
            {{ messages.signIn }}
          </AppButton>
          <AppButton size="sm" variant="outline" @click="openEditor">
            {{ messages.openEditor }}
          </AppButton>
          <AccountAvatar v-if="user" :id="user.userId" :name="user.name" :image="user.image" />
        </div>
      </div>
    </header>
    <main :class="ui.main()">
      <slot />
    </main>
    <PortalFooter :host="portal.host" />
  </div>
</template>
