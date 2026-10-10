<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import { menu } from '@/components/ui/menu/menu'
import Tip from '@/components/ui/overlay/Tip.vue'
import { sideList } from '@/theme/list/side-list'

import type { HomeCloudAccount, HomeLocation } from '../cloud/types'

/**
 * Where the home tab can show documents from: recent files, each Cloud workspace of the signed-in
 * account, documents shared with that account, and the configured storage bucket.
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
  /** The configured storage bucket, or null when no storage is set up. */
  storage?: { label: string; detail: string } | null
}>()

const emit = defineEmits<{
  select: [location: HomeLocation]
  connect: []
  accountSettings: []
  storageSettings: []
  switchServer: []
  signOut: []
}>()

const ui = sideList()
const menuUI = menu()
const isActive = (location: HomeLocation) =>
  active.kind === location.kind && active.id === location.id
const workspaceLocations = computed(() =>
  workspaces.map((workspace) => ({
    ...workspace,
    location: { kind: 'workspace', id: workspace.id } satisfies HomeLocation
  }))
)
</script>

<template>
  <nav :class="ui.root()" aria-label="Locations">
    <div :class="[ui.items(), 'pt-1']">
      <button
        type="button"
        :class="ui.item()"
        :data-active="isActive({ kind: 'recent', id: 'recent' })"
        @click="emit('select', { kind: 'recent', id: 'recent' })"
      >
        <icon-lucide-clock :class="ui.icon()" />
        <span :class="ui.label()">Recent</span>
      </button>
    </div>

    <div :class="ui.group()">
      <div :class="ui.header()">
        <span :class="ui.title()">OpenPencil Cloud</span>
        <DropdownMenuRoot v-if="account" :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton :label="`Account: ${account.email}`">
              <icon-lucide-ellipsis class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="bottom"
              align="end"
              :side-offset="4"
              :class="[menuUI.content(), 'w-56']"
            >
              <DropdownMenuLabel :class="menuUI.label()">
                {{ account.email }} · {{ account.host }}
              </DropdownMenuLabel>
              <DropdownMenuItem
                :class="menuUI.item({ justify: 'start' })"
                @select="emit('accountSettings')"
              >
                <icon-lucide-settings-2 :class="menuUI.icon()" />
                Account settings
              </DropdownMenuItem>
              <DropdownMenuItem
                :class="menuUI.item({ justify: 'start' })"
                @select="emit('switchServer')"
              >
                <icon-lucide-server :class="menuUI.icon()" />
                Connect another server…
              </DropdownMenuItem>
              <DropdownMenuSeparator :class="menuUI.separator()" />
              <DropdownMenuItem
                :class="menuUI.item({ justify: 'start' })"
                @select="emit('signOut')"
              >
                <icon-lucide-log-out :class="menuUI.icon()" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
      <div :class="ui.items()">
        <template v-if="account">
          <button
            v-for="workspace in workspaceLocations"
            :key="workspace.id"
            type="button"
            :class="ui.item()"
            :data-active="isActive(workspace.location)"
            @click="emit('select', workspace.location)"
          >
            <icon-lucide-layers :class="ui.icon()" />
            <span :class="ui.label()">{{ workspace.name }}</span>
            <span :class="ui.trailing()">
              <Tip v-if="workspace.attention" label="A file here needs a choice">
                <icon-lucide-git-compare-arrows
                  :class="ui.attention()"
                  role="img"
                  aria-label="Needs attention"
                />
              </Tip>
              <template v-else>{{ workspace.documentCount }}</template>
            </span>
          </button>
          <button
            type="button"
            :class="ui.item()"
            :data-active="isActive({ kind: 'shared', id: 'shared' })"
            @click="emit('select', { kind: 'shared', id: 'shared' })"
          >
            <icon-lucide-users :class="ui.icon()" />
            <span :class="ui.label()">Shared with you</span>
            <span v-if="sharedCount" :class="ui.trailing()">{{ sharedCount }}</span>
          </button>
        </template>
        <button v-else type="button" :class="ui.item()" @click="emit('connect')">
          <icon-lucide-log-in :class="ui.icon()" />
          <span :class="ui.label()">Sign in…</span>
        </button>
      </div>
    </div>

    <div v-if="storage" :class="ui.group()">
      <div :class="ui.header()">
        <span :class="ui.title()">Storage</span>
        <IconButton label="Storage settings" @click="emit('storageSettings')">
          <icon-lucide-settings-2 class="size-3.5" />
        </IconButton>
      </div>
      <div :class="ui.items()">
        <button
          type="button"
          :class="ui.item()"
          :data-active="isActive({ kind: 'storage', id: 'storage' })"
          @click="emit('select', { kind: 'storage', id: 'storage' })"
        >
          <icon-lucide-database :class="ui.icon()" />
          <span :class="ui.label()">{{ storage.label }}</span>
          <span :class="ui.trailing()">{{ storage.detail }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>
