<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { ref } from 'vue'

import AccountAvatar from '@/components/presence/AccountAvatar.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { menu } from '@/components/ui/menu/menu'
import { portalList } from '@/theme/cloud-portal/list'

import type { PortalPerson } from '../types'

/** Everyone with an account on the server, with what an administrator can change about them. */
const { people } = defineProps<{ people: PortalPerson[] }>()
const emit = defineEmits<{
  toggleAdmin: [id: string]
  signOutEverywhere: [id: string]
  toggleSuspended: [id: string]
}>()

const ui = portalList()
const menuUI = menu()
const query = ref('')
</script>

<template>
  <div class="flex flex-col gap-3">
    <div :class="ui.toolbar()">
      <AppInput
        v-model="query"
        type="search"
        density="compact"
        placeholder="Search people…"
        aria-label="Search people"
        class="w-64"
      >
        <template #leading><icon-lucide-search class="size-3.5" /></template>
      </AppInput>
    </div>
    <ul :class="ui.list()">
      <li v-for="person in people" :key="person.id" :class="ui.row()">
        <AccountAvatar :id="person.id" :name="person.name" size="md" />
        <div :class="ui.body()">
          <p :class="ui.title()">
            {{ person.name }}
            <span v-if="person.you" class="font-normal text-muted">(you)</span>
          </p>
          <p :class="ui.detail()">{{ person.email }}</p>
        </div>
        <span v-if="person.admin" :class="ui.status()" data-tone="neutral">Administrator</span>
        <span v-if="person.suspended" :class="ui.status()" data-tone="error">Suspended</span>
        <span v-if="!person.twoStep && person.admin" :class="ui.status()" data-tone="warning"
          >No two-step</span
        >
        <span :class="ui.meta()">Joined {{ person.joinedAgo }}</span>
        <DropdownMenuRoot :modal="false">
          <DropdownMenuTrigger as-child>
            <IconButton :label="`Actions for ${person.name}`" :disabled="person.you">
              <icon-lucide-ellipsis class="size-3.5" />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuContent
              side="bottom"
              align="end"
              :side-offset="4"
              :class="[menuUI.content(), 'w-52']"
            >
              <DropdownMenuItem
                :class="menuUI.item({ justify: 'start' })"
                @select="emit('toggleAdmin', person.id)"
              >
                {{ person.admin ? 'Remove administrator' : 'Make administrator' }}
              </DropdownMenuItem>
              <DropdownMenuItem
                :class="menuUI.item({ justify: 'start' })"
                @select="emit('signOutEverywhere', person.id)"
              >
                Sign out everywhere
              </DropdownMenuItem>
              <DropdownMenuSeparator :class="menuUI.separator()" />
              <DropdownMenuItem
                :class="menuUI.item({ justify: 'start' })"
                @select="emit('toggleSuspended', person.id)"
              >
                {{ person.suspended ? 'Restore account' : 'Suspend account' }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </li>
    </ul>
  </div>
</template>
