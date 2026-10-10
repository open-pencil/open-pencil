<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { useCloudMessages } from '@open-pencil/vue'

import { menu } from '@/components/ui/menu/menu'
import { homeLocationMenu } from '@/theme/home/location-menu'

import type { HomeCloudAccount, HomeLocation } from '../cloud/types'

/**
 * The home tab's locations on a phone, where the sidebar does not fit: the current one as a
 * button, and the same places as the sidebar in a menu.
 */
const {
  active,
  account = null,
  workspaces = [],
  sharedCount = 0,
  storage = null
} = defineProps<{
  active: HomeLocation
  account?: HomeCloudAccount | null
  workspaces?: { id: string; name: string; documentCount?: number; attention?: boolean }[]
  sharedCount?: number
  storage?: { label: string; detail: string } | null
}>()

const emit = defineEmits<{ select: [location: HomeLocation]; connect: [] }>()

const ui = homeLocationMenu()
const menuUI = menu()
const t = useCloudMessages()
const current = computed(() => {
  if (active.kind === 'recent') return t.value.homeRecent
  if (active.kind === 'shared') return t.value.homeSharedWithYou
  if (active.kind === 'storage') return storage?.label ?? t.value.homeStorage
  return workspaces.find((workspace) => workspace.id === active.id)?.name ?? t.value.workspace
})
const isActive = (location: HomeLocation) =>
  active.kind === location.kind && active.id === location.id
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger :class="ui.trigger()">
      <icon-lucide-clock v-if="active.kind === 'recent'" :class="ui.icon()" />
      <icon-lucide-users v-else-if="active.kind === 'shared'" :class="ui.icon()" />
      <icon-lucide-database v-else-if="active.kind === 'storage'" :class="ui.icon()" />
      <icon-lucide-layers v-else :class="ui.icon()" />
      <span :class="ui.label()">{{ current }}</span>
      <icon-lucide-chevrons-up-down :class="ui.chevron()" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        side="bottom"
        align="start"
        :side-offset="4"
        :class="[menuUI.content(), ui.content()]"
      >
        <DropdownMenuItem
          :class="menuUI.item({ justify: 'start' })"
          @select="emit('select', { kind: 'recent', id: 'recent' })"
        >
          <icon-lucide-clock :class="menuUI.icon()" />
          <span :class="ui.itemLabel()">{{ t.homeRecent }}</span>
          <icon-lucide-check
            v-if="isActive({ kind: 'recent', id: 'recent' })"
            :class="ui.check()"
          />
        </DropdownMenuItem>

        <DropdownMenuSeparator :class="menuUI.separator()" />
        <DropdownMenuGroup>
          <DropdownMenuLabel :class="menuUI.label()">
            {{ account ? t.homeCloudOnHost({ host: account.host }) : t.productName }}
          </DropdownMenuLabel>
          <template v-if="account">
            <DropdownMenuItem
              v-for="workspace in workspaces"
              :key="workspace.id"
              :class="menuUI.item({ justify: 'start' })"
              @select="emit('select', { kind: 'workspace', id: workspace.id })"
            >
              <icon-lucide-layers :class="menuUI.icon()" />
              <span :class="ui.itemLabel()">{{ workspace.name }}</span>
              <icon-lucide-check
                v-if="isActive({ kind: 'workspace', id: workspace.id })"
                :class="ui.check()"
              />
              <icon-lucide-git-compare-arrows
                v-else-if="workspace.attention"
                :class="ui.attention()"
                role="img"
                :aria-label="t.homeNeedsAttention"
              />
              <span v-else :class="ui.count()">{{ workspace.documentCount }}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              :class="menuUI.item({ justify: 'start' })"
              @select="emit('select', { kind: 'shared', id: 'shared' })"
            >
              <icon-lucide-users :class="menuUI.icon()" />
              <span :class="ui.itemLabel()">{{ t.homeSharedWithYou }}</span>
              <icon-lucide-check
                v-if="isActive({ kind: 'shared', id: 'shared' })"
                :class="ui.check()"
              />
              <span v-else-if="sharedCount" :class="ui.count()">{{ sharedCount }}</span>
            </DropdownMenuItem>
          </template>
          <DropdownMenuItem
            v-else
            :class="menuUI.item({ justify: 'start' })"
            @select="emit('connect')"
          >
            <icon-lucide-log-in :class="menuUI.icon()" />
            {{ t.homeSignIn }}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <template v-if="storage">
          <DropdownMenuSeparator :class="menuUI.separator()" />
          <DropdownMenuItem
            :class="menuUI.item({ justify: 'start' })"
            @select="emit('select', { kind: 'storage', id: 'storage' })"
          >
            <icon-lucide-database :class="menuUI.icon()" />
            <span :class="ui.itemLabel()">{{ storage.label }}</span>
            <icon-lucide-check
              v-if="isActive({ kind: 'storage', id: 'storage' })"
              :class="ui.check()"
            />
            <span v-else :class="ui.count()">{{ storage.detail }}</span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
