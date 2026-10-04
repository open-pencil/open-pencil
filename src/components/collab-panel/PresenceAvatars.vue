<script setup lang="ts">
import {
  HoverCardContent,
  HoverCardPortal,
  HoverCardRoot,
  HoverCardTrigger,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { colorToCSS } from '@open-pencil/scene-graph/color'
import { useI18n } from '@open-pencil/vue'

import type { FollowTarget } from '@/app/presence/types'
import { initials } from '@/app/shell/ui'
import AppButton from '@/components/ui/button/AppButton.vue'
import { avatar } from '@/theme/collaboration/avatar'
import { presenceAvatars } from '@/theme/collaboration/presence-avatars'

import { isFollowing, type PresencePersonRow } from './presence'
import PresenceList from './PresenceList.vue'

/** How many collaborators the stack shows before "+N". */
const MAX_PEERS = 3

const {
  rows,
  following,
  connected = false
} = defineProps<{
  /** Ourselves first, then everyone else in the room. */
  rows: PresencePersonRow[]
  following: FollowTarget | null
  connected?: boolean
}>()

const emit = defineEmits<{
  follow: [target: FollowTarget | null]
  rename: [agentId: string, name: string]
  leave: []
}>()

const { common, collaboration: messages } = useI18n()
const ui = presenceAvatars()

const self = computed(() => rows[0])
const peers = computed(() => rows.slice(1, MAX_PEERS + 1))
const hidden = computed(() => Math.max(0, rows.length - 1 - MAX_PEERS))

function personTarget(clientId: number): FollowTarget {
  return { kind: 'person', clientId }
}

function toggleFollow(clientId: number) {
  const target = personTarget(clientId)
  emit('follow', isFollowing(following, target) ? null : target)
}
</script>

<template>
  <div data-test-id="collab-avatars" :class="ui.root()">
    <PopoverRoot v-if="self">
      <PopoverTrigger as-child>
        <button
          type="button"
          data-test-id="collab-local-avatar"
          :aria-label="`${self.name || common.you} (${common.youSuffix})`"
          :class="ui.trigger()"
        >
          <span
            :class="avatar({ bordered: true, interactive: true })"
            :style="{ background: colorToCSS(self.color) }"
          >
            {{ initials(self.name || common.you) }}
          </span>
          <span
            v-if="connected"
            data-test-id="collab-live"
            role="img"
            :aria-label="messages.connected"
            :class="ui.live()"
          />
          <span
            v-if="self.agents.length > 0"
            :class="ui.badge()"
            :style="{ color: colorToCSS(self.color) }"
          >
            <icon-lucide-sparkle :class="ui.badgeIcon()" />{{ self.agents.length }}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          data-test-id="collab-self-menu"
          :class="ui.card()"
          :side-offset="8"
          align="end"
        >
          <PresenceList
            :rows="[self]"
            :following="following"
            @follow="emit('follow', $event)"
            @rename="(id, name) => emit('rename', id, name)"
          />
          <AppButton
            v-if="connected"
            variant="outline"
            :class="ui.leave()"
            data-test-id="collab-leave-room"
            @click="emit('leave')"
          >
            {{ messages.leaveRoom }}
          </AppButton>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>

    <HoverCardRoot v-for="peer in peers" :key="peer.clientId" :open-delay="250" :close-delay="150">
      <HoverCardTrigger as-child>
        <button
          v-if="peer.clientId !== undefined"
          type="button"
          data-test-id="collab-peer-avatar"
          :data-following="isFollowing(following, personTarget(peer.clientId)) || undefined"
          :aria-label="
            isFollowing(following, personTarget(peer.clientId))
              ? messages.stopFollowing({ name: peer.name })
              : messages.follow({ name: peer.name })
          "
          :class="ui.trigger()"
          @click="toggleFollow(peer.clientId)"
        >
          <span
            :class="
              avatar({
                bordered: true,
                interactive: true,
                following: isFollowing(following, personTarget(peer.clientId))
              })
            "
            :style="{ background: colorToCSS(peer.color) }"
          >
            {{ initials(peer.name) }}
          </span>
          <span
            v-if="peer.agents.length > 0"
            :class="ui.badge()"
            :style="{ color: colorToCSS(peer.color) }"
          >
            <icon-lucide-sparkle :class="ui.badgeIcon()" />{{ peer.agents.length }}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent
          data-test-id="collab-peer-card"
          :class="ui.card()"
          :side-offset="8"
          align="end"
        >
          <PresenceList :rows="[peer]" :following="following" @follow="emit('follow', $event)" />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCardRoot>

    <!-- Everyone, by click or keyboard: hover cards are mouse-only. -->
    <PopoverRoot v-if="rows.length > 1">
      <PopoverTrigger as-child>
        <button
          type="button"
          data-test-id="collab-everyone"
          :aria-label="
            hidden > 0 ? messages.morePeople({ count: String(hidden) }) : messages.inThisRoom
          "
          :class="ui.overflow()"
        >
          <template v-if="hidden > 0">+{{ hidden }}</template>
          <icon-lucide-chevron-down v-else :class="ui.badgeIcon()" />
        </button>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent :class="ui.card()" :side-offset="8" align="end">
          <PresenceList
            :rows="rows"
            :following="following"
            @follow="emit('follow', $event)"
            @rename="(id, name) => emit('rename', id, name)"
          />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
