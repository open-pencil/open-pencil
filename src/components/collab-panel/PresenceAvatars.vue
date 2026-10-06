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

import { useI18n } from '@open-pencil/vue'

import type { FollowTarget } from '@/app/presence/types'
import AvatarStack from '@/components/presence/AvatarStack.vue'
import PersonAvatar from '@/components/presence/PersonAvatar.vue'
import PresenceList from '@/components/presence/PresenceList.vue'
import { isFollowing, type PresencePersonRow } from '@/components/presence/rows'
import AppButton from '@/components/ui/button/AppButton.vue'
import { presenceAvatars } from '@/theme/collaboration/presence-avatars'

/** How many collaborators the stack shows besides you before "+N". */
const MAX_PEERS = 3

const {
  rows,
  following,
  connected = false,
  inRoom = false
} = defineProps<{
  /** Ourselves first, then everyone else in the room. */
  rows: PresencePersonRow[]
  following: FollowTarget | null
  /** Whether someone else in the room answered, so the room is live. */
  connected?: boolean
  /** Whether we are in a room at all, so we can leave it. */
  inRoom?: boolean
}>()

const emit = defineEmits<{
  follow: [target: FollowTarget | null]
  rename: [agentId: string, name: string]
  leave: []
}>()

const { common, collaboration: messages } = useI18n()
const ui = presenceAvatars()

function personTarget(clientId: number): FollowTarget {
  return { kind: 'person', clientId }
}

function toggleFollow(clientId: number) {
  const target = personTarget(clientId)
  emit('follow', isFollowing(following, target) ? null : target)
}
</script>

<template>
  <AvatarStack data-test-id="collab-avatars" :people="rows" :max="MAX_PEERS + 1">
    <template #person="{ person }">
      <PopoverRoot v-if="person.clientId === undefined">
        <PopoverTrigger as-child>
          <button
            type="button"
            data-test-id="collab-local-avatar"
            :aria-label="`${person.name || common.you} (${common.youSuffix})`"
            :class="ui.trigger()"
          >
            <PersonAvatar
              :name="person.name || common.you"
              :color="person.color"
              :agent-count="person.agents.length"
              interactive
            />
            <span
              v-if="connected"
              data-test-id="collab-live"
              role="img"
              :aria-label="messages.connected"
              :class="ui.live()"
            />
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
              :rows="[person]"
              :following="following"
              @follow="emit('follow', $event)"
              @rename="(id, name) => emit('rename', id, name)"
            />
            <AppButton
              v-if="inRoom"
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

      <HoverCardRoot v-else :open-delay="250" :close-delay="150">
        <HoverCardTrigger as-child>
          <button
            type="button"
            data-test-id="collab-peer-avatar"
            :data-following="isFollowing(following, personTarget(person.clientId)) || undefined"
            :aria-label="
              isFollowing(following, personTarget(person.clientId))
                ? messages.stopFollowing({ name: person.name })
                : messages.follow({ name: person.name })
            "
            :class="ui.trigger()"
            @click="toggleFollow(person.clientId)"
          >
            <PersonAvatar
              :name="person.name"
              :color="person.color"
              :agent-count="person.agents.length"
              :following="isFollowing(following, personTarget(person.clientId))"
              interactive
            />
          </button>
        </HoverCardTrigger>
        <HoverCardPortal>
          <HoverCardContent
            data-test-id="collab-peer-card"
            :class="ui.card()"
            :side-offset="8"
            align="end"
          >
            <PresenceList
              :rows="[person]"
              :following="following"
              @follow="emit('follow', $event)"
            />
          </HoverCardContent>
        </HoverCardPortal>
      </HoverCardRoot>
    </template>

    <!-- Everyone, by click or keyboard: hover cards are mouse-only. -->
    <template #overflow="{ hidden }">
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
            <icon-lucide-chevron-down v-else :class="ui.chevron()" />
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
    </template>
  </AvatarStack>
</template>
