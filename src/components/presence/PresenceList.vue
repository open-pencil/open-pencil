<script setup lang="ts">
import { colorToCSS } from '@open-pencil/scene-graph/color'
import { useI18n, useInlineRename } from '@open-pencil/vue'

import type { FollowTarget } from '@/app/presence/types'
import { initials } from '@/app/shell/ui'
import IconButton from '@/components/ui/button/IconButton.vue'
import { avatar } from '@/theme/collaboration/avatar'
import { presenceList } from '@/theme/collaboration/presence-list'

import { isFollowing, type PresenceAgentRow, type PresencePersonRow } from './rows'

const { rows, following } = defineProps<{
  rows: PresencePersonRow[]
  following: FollowTarget | null
}>()

const emit = defineEmits<{
  follow: [target: FollowTarget | null]
  rename: [agentId: string, name: string]
}>()

const { common, collaboration: messages } = useI18n()
const ui = presenceList()

const rename = useInlineRename<string>((agentId, name) => emit('rename', agentId, name))

/** The rename input sits inside v-for, so take it from a function ref rather than an array. */
function focusRename(element: unknown) {
  if (element instanceof HTMLInputElement) void rename.focusInput(element)
}

function toggle(target: FollowTarget) {
  emit('follow', isFollowing(following, target) ? null : target)
}

function status(agent: PresenceAgentRow): string {
  const label = {
    thinking: messages.value.agentThinking,
    editing: messages.value.agentEditing,
    idle: messages.value.agentIdle
  }[agent.status]
  // The page is a document name, not translated text, so a separator joins the two.
  return agent.page ? `${label} · ${agent.page}` : label
}

function followLabel(name: string, target: FollowTarget): string {
  return isFollowing(following, target)
    ? messages.value.stopFollowing({ name })
    : messages.value.follow({ name })
}
</script>

<template>
  <ul data-test-id="collab-presence-list" :class="ui.root()">
    <li v-for="person in rows" :key="person.clientId ?? 'self'">
      <div data-slot="person" :class="ui.person()">
        <div :class="avatar()" :style="{ background: colorToCSS(person.color) }">
          {{ initials(person.name || common.you) }}
        </div>
        <span :class="ui.name()">
          {{
            person.clientId === undefined
              ? `${person.name || common.you} (${common.youSuffix})`
              : person.name
          }}
        </span>
        <IconButton
          v-if="person.clientId !== undefined"
          :label="followLabel(person.name, { kind: 'person', clientId: person.clientId })"
          :active="isFollowing(following, { kind: 'person', clientId: person.clientId })"
          @click="toggle({ kind: 'person', clientId: person.clientId })"
        >
          <icon-lucide-locate-fixed class="size-3.5" />
        </IconButton>
      </div>
      <ul v-if="person.agents.length > 0">
        <li v-for="agent in person.agents" :key="agent.id" data-slot="agent" :class="ui.agent()">
          <icon-lucide-sparkle
            :class="ui.agentIcon()"
            :style="{ color: colorToCSS(person.color) }"
          />
          <input
            v-if="rename.editingId.value === agent.id"
            :ref="focusRename"
            :aria-label="messages.agentName"
            :class="ui.renameInput()"
            :value="agent.name"
            @blur="rename.commit(agent.id, $event)"
            @keydown.stop="rename.onKeydown"
          />
          <button
            v-else-if="agent.renamable"
            type="button"
            :aria-label="messages.renameAgent({ name: agent.name })"
            :class="ui.agentName()"
            @click="rename.start(agent.id, agent.name)"
            @keydown.enter.prevent="rename.start(agent.id, agent.name)"
          >
            {{ agent.name }}
          </button>
          <span v-else :class="ui.agentName()">{{ agent.name }}</span>
          <span :class="ui.status()">{{ status(agent) }}</span>
          <IconButton
            :label="followLabel(agent.name, { kind: 'agent', agentId: agent.id })"
            :active="isFollowing(following, { kind: 'agent', agentId: agent.id })"
            @click="toggle({ kind: 'agent', agentId: agent.id })"
          >
            <icon-lucide-locate-fixed class="size-3.5" />
          </IconButton>
        </li>
      </ul>
    </li>
  </ul>
</template>
