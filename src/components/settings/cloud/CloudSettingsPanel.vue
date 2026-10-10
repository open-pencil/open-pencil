<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsPage from '@/components/settings/layout/SettingsPage.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import { menu } from '@/components/ui/menu/menu'
import { cloudServers } from '@/theme/cloud/servers'

import type { CloudServerEntry } from './types'

/**
 * The Cloud servers this app syncs with: who is signed in to each, which one Home shows, and
 * what can be done with it. Account settings live on the server's own pages, opened in a browser.
 */
const { servers } = defineProps<{ servers: CloudServerEntry[] }>()
const emit = defineEmits<{
  connect: [kind?: 'official' | 'self-hosted']
  signIn: [id: string]
  manageAccount: [id: string]
  showOnHome: [id: string]
  signOut: [id: string]
  remove: [id: string]
}>()

const ui = cloudServers()
const menuUI = menu()
const title = (server: CloudServerEntry) =>
  server.kind === 'official' ? 'OpenPencil Cloud' : server.host
</script>

<template>
  <SettingsPage>
    <SettingsSection>
      <template #title>OpenPencil Cloud</template>
      <template #description>
        {{
          servers.length
            ? 'Servers this app syncs documents with. Home shows one server’s workspaces at a time.'
            : 'Keep files in sync across devices and edit them with others. Documents on this device stay where they are.'
        }}
      </template>
      <template v-if="servers.length" #actions>
        <AppButton size="sm" variant="outline" @click="emit('connect')">
          <template #leading><icon-lucide-plus class="size-3.5" /></template>
          Connect a server
        </AppButton>
      </template>

      <div v-if="!servers.length" :class="ui.choices()">
        <AppActionRow @click="emit('connect', 'official')">
          <template #leading>
            <span :class="ui.choiceIcon()"><icon-lucide-cloud class="size-4" /></span>
          </template>
          OpenPencil Cloud
          <template #description>Hosted by OpenPencil, nothing to set up.</template>
          <template #trailing><icon-lucide-chevron-right class="size-3.5" /></template>
        </AppActionRow>
        <AppActionRow @click="emit('connect', 'self-hosted')">
          <template #leading>
            <span :class="ui.choiceIcon()"><icon-lucide-server class="size-4" /></span>
          </template>
          Your team’s server
          <template #description
            >A self-hosted OpenPencil Cloud, at the address your team uses.</template
          >
          <template #trailing><icon-lucide-chevron-right class="size-3.5" /></template>
        </AppActionRow>
      </div>

      <SettingsGroup v-else>
        <div v-for="server in servers" :key="server.id" :class="ui.row()">
          <span :class="ui.icon()">
            <icon-lucide-cloud v-if="server.kind === 'official'" class="size-4" />
            <icon-lucide-server v-else class="size-4" />
          </span>
          <div :class="ui.body()">
            <div :class="ui.titleRow()">
              <span :class="ui.title()">{{ title(server) }}</span>
              <span v-if="server.kind === 'official'" :class="ui.host()">{{ server.host }}</span>
              <span v-if="server.onHome" :class="ui.badge()">On Home</span>
            </div>
            <p v-if="server.session === 'expired'" :class="ui.expired()">
              <icon-lucide-circle-alert class="size-3 shrink-0" />
              Sign-in expired{{ server.account ? ` for ${server.account.email}` : '' }}
            </p>
            <p v-else-if="server.account && server.session === 'signed-in'" :class="ui.account()">
              <AccountAvatar :id="server.account.id" :name="server.account.name" />
              <span :class="ui.accountText()">
                {{ server.account.name }} · {{ server.account.email }}
              </span>
            </p>
            <p v-else :class="ui.account()">Signed out</p>
          </div>
          <div :class="ui.trailing()">
            <AppButton
              v-if="server.session !== 'signed-in'"
              size="sm"
              variant="outline"
              @click="emit('signIn', server.id)"
            >
              Sign in
            </AppButton>
            <DropdownMenuRoot :modal="false">
              <DropdownMenuTrigger as-child>
                <IconButton :label="`Options for ${server.host}`">
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
                  <DropdownMenuItem
                    v-if="server.session === 'signed-in'"
                    :class="menuUI.item({ justify: 'start' })"
                    @select="emit('manageAccount', server.id)"
                  >
                    <icon-lucide-external-link :class="menuUI.icon()" />
                    Account and security
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="!server.onHome"
                    :class="menuUI.item({ justify: 'start' })"
                    @select="emit('showOnHome', server.id)"
                  >
                    <icon-lucide-house :class="menuUI.icon()" />
                    Show on Home
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="server.session === 'signed-in'"
                    :class="menuUI.item({ justify: 'start' })"
                    @select="emit('signOut', server.id)"
                  >
                    <icon-lucide-log-out :class="menuUI.icon()" />
                    Sign out
                  </DropdownMenuItem>
                  <DropdownMenuSeparator :class="menuUI.separator()" />
                  <DropdownMenuItem
                    :class="menuUI.item({ justify: 'start' })"
                    @select="emit('remove', server.id)"
                  >
                    <icon-lucide-trash-2 :class="menuUI.icon()" />
                    Remove from this app
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenuPortal>
            </DropdownMenuRoot>
          </div>
        </div>
      </SettingsGroup>
    </SettingsSection>
  </SettingsPage>
</template>
