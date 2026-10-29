<script setup lang="ts">
import { uniq } from 'es-toolkit'
import { tv } from 'tailwind-variants'
import { useTemplateRef, watch } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import BrandMark from '@/components/brand/BrandMark.vue'
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import { useAppButtonUI } from '@/components/ui/button/button'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSkeleton from '@/components/ui/feedback/AppSkeleton.vue'
import { skeleton } from '@/components/ui/feedback/skeleton'
import { sideList } from '@/components/ui/list/side-list'
import { useScrollOverflow } from '@/components/ui/list/useScrollOverflow'
import portalLayoutTheme from '@/theme/cloud-portal/layout'

import type { PortalSection } from '../types'

const portalLayout = tv(portalLayoutTheme)

/**
 * Signed-in Cloud pages: account settings and, for operators, the deployment console. The bar
 * leads back to the editor at the server's root.
 */
const { host, account, sections, active, heading, description } = defineProps<{
  host: string
  account: { id: string; name: string; email: string; image?: string | null }
  sections: PortalSection[]
  active: string
  heading: string
  /** Null while it is still being counted, which keeps its line with a placeholder. */
  description?: string | null
}>()
const emit = defineEmits<{ select: [id: string]; signOut: [] }>()

const ui = portalLayout()
const messages = useCloudPortalMessages()
const side = sideList()
const groups = () => uniq(sections.map((section) => section.group))
const editorLink = useAppButtonUI({ variant: 'outline', size: 'sm' })
const placeholders = skeleton()
const nav = useTemplateRef<HTMLElement>('nav')
const { overflowing, overflowStart, overflowEnd, scrollTowardHidden } = useScrollOverflow(nav)

// On a narrow page the sections are one row; keep the current one in view, as the editor's tab
// bar keeps its active tab, also once the row starts overflowing.
watch(
  [() => active, overflowing],
  () => {
    nav.value
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  },
  { flush: 'post' }
)
</script>

<template>
  <div :class="ui.page()">
    <header :class="ui.bar()">
      <a href="/" :class="ui.barHome()">
        <BrandMark variant="micro" decorative />
        <span :class="ui.barTitle()">{{ messages.productName }}</span>
      </a>
      <span :class="ui.barHost()">{{ host }}</span>
      <div :class="ui.barEnd()">
        <a href="/" :class="editorLink.base">{{ messages.openEditor }}</a>
        <span :class="ui.barHost()">{{ account.email }}</span>
        <AccountAvatar :id="account.id" :name="account.name" :image="account.image" />
        <IconButton :label="messages.signOut" @click="emit('signOut')">
          <icon-lucide-log-out class="size-3.5" />
        </IconButton>
      </div>
    </header>
    <div :class="ui.console()">
      <div :class="ui.navFrame()">
        <nav
          ref="nav"
          :class="side.root({ class: ui.nav() })"
          :aria-label="messages.productName"
          :data-overflow-start="overflowStart || undefined"
          :data-overflow-end="overflowEnd || undefined"
        >
          <div v-for="group in groups()" :key="group" :class="side.group({ class: ui.navGroup() })">
            <div :class="side.header({ class: ui.navHeader() })">
              <span :class="side.title()">{{ group }}</span>
            </div>
            <div :class="side.items({ class: ui.navItems() })">
              <button
                v-for="section in sections.filter((candidate) => candidate.group === group)"
                :key="section.id"
                type="button"
                :class="side.item({ class: ui.navItem() })"
                :data-active="section.id === active"
                :aria-current="section.id === active ? 'page' : undefined"
                @click="emit('select', section.id)"
              >
                <component :is="section.icon" :class="side.icon()" />
                <span :class="side.label()">{{ section.label }}</span>
                <span v-if="section.count" :class="side.trailing()">{{ section.count }}</span>
              </button>
            </div>
          </div>
        </nav>
        <!-- Pointer affordance only: Tab already reaches every section and scrolls it into view. -->
        <button
          v-if="overflowStart || overflowEnd"
          type="button"
          tabindex="-1"
          aria-hidden="true"
          :class="ui.navScroll()"
          :data-start="!overflowEnd || undefined"
          @click="scrollTowardHidden"
        >
          <icon-lucide-chevron-right v-if="overflowEnd" class="size-3.5" />
          <icon-lucide-chevron-left v-else class="size-3.5" />
        </button>
      </div>
      <main :class="ui.main()">
        <div :class="ui.mainInner()">
          <header>
            <h1 :class="ui.pageTitle()">{{ heading }}</h1>
            <p v-if="description" :class="ui.pageDescription()">{{ description }}</p>
            <p
              v-else-if="description === null"
              :class="[ui.pageDescription(), placeholders.group()]"
            >
              <AppSkeleton class="inline-block w-40 align-middle" />
            </p>
          </header>
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
