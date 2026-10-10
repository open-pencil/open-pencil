<script setup lang="ts">
import { uniq } from 'es-toolkit'

import { useCloudPortalMessages } from '@open-pencil/vue'

import BrandMark from '@/components/brand/BrandMark.vue'
import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { portalLayout } from '@/theme/cloud-portal/layout'
import { sideList } from '@/theme/list/side-list'

import type { PortalSection } from '../types'

/**
 * Signed-in Cloud pages: account settings and, for operators, the deployment console. The side
 * list is drawn like the editor's Pages panel.
 */
const { host, account, sections, active, heading, description } = defineProps<{
  host: string
  account: { id: string; name: string; email: string }
  sections: PortalSection[]
  active: string
  heading: string
  description?: string
}>()
const emit = defineEmits<{ select: [id: string]; signOut: [] }>()

const ui = portalLayout()
const messages = useCloudPortalMessages()
const side = sideList()
const groups = () => uniq(sections.map((section) => section.group))
</script>

<template>
  <div :class="ui.page()">
    <header :class="ui.bar()">
      <BrandMark variant="micro" decorative />
      <span :class="ui.barTitle()">{{ messages.productName }}</span>
      <span :class="ui.barHost()">{{ host }}</span>
      <div :class="ui.barEnd()">
        <span :class="ui.barHost()">{{ account.email }}</span>
        <AccountAvatar :id="account.id" :name="account.name" />
        <IconButton :label="messages.signOut" @click="emit('signOut')">
          <icon-lucide-log-out class="size-3.5" />
        </IconButton>
      </div>
    </header>
    <div :class="ui.console()">
      <nav :class="side.root({ class: ui.nav() })" :aria-label="messages.productName">
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
              <span :class="side.label()">{{ section.label }}</span>
              <span v-if="section.count" :class="side.trailing()">{{ section.count }}</span>
            </button>
          </div>
        </div>
      </nav>
      <main :class="ui.main()">
        <div :class="ui.mainInner()">
          <header>
            <h1 :class="ui.pageTitle()">{{ heading }}</h1>
            <p v-if="description" :class="ui.pageDescription()">{{ description }}</p>
          </header>
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
