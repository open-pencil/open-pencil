<script setup lang="ts">
import { computed } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import { isFetchingRoom, type PendingRoomStatus } from '@/app/collab/room/status'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { roomScreen } from '@/theme/collaboration/room-screen'

import RoomNameLine from './RoomNameLine.vue'

/**
 * What a room tab shows instead of the editor until the room's document arrives: what it is doing
 * to get the file, why nothing is here yet when nobody who has it is online, or that it cannot
 * reach the room at all. Nothing on it can edit the document.
 */
const {
  status,
  sender = null,
  othersWaiting = [],
  name,
  copied = false,
  desktopLink = null,
  downloadURL = null
} = defineProps<{
  status: PendingRoomStatus
  /** Who the file is coming from, while it is on its way. */
  sender?: string | null
  /** People in the room who are waiting for the file too. */
  othersWaiting?: string[]
  /** The person's name in the room, generated until they set one. */
  name: string
  copied?: boolean
  /** An `openpencil://join` link, offered in desktop browsers. */
  desktopLink?: string | null
  /** Where to get the desktop app, offered beside `desktopLink`. */
  downloadURL?: string | null
}>()

const emit = defineEmits<{
  copyLink: []
  leave: []
  rename: [name: string]
}>()

const messages = useCollaborationMessages()
const ui = roomScreen()

const fetching = computed(() => isFetchingRoom(status))
const progress = computed(() => {
  if (status === 'receiving' && sender) return messages.value.receivingDescription({ name: sender })
  if (status === 'looking') return messages.value.lookingDescription
  return messages.value.connectingDescription
})
</script>

<template>
  <div
    :class="ui.root()"
    data-test-id="room-screen"
    :data-status="status"
    role="status"
    aria-live="polite"
    :aria-busy="fetching"
  >
    <AppPlaceholder
      v-if="fetching"
      size="page"
      label-as="h2"
      :label="messages.joiningTitle"
      :description="progress"
      :ui="{ label: ui.title(), description: ui.description() }"
    >
      <template #icon>
        <icon-lucide-loader-circle :class="ui.spinner()" />
      </template>
      <template #action>
        <AppButton
          color="neutral"
          variant="ghost"
          data-test-id="room-screen-leave"
          @click="emit('leave')"
        >
          {{ messages.leave }}
        </AppButton>
      </template>
    </AppPlaceholder>

    <AppPlaceholder
      v-else-if="status === 'unreachable'"
      size="page"
      label-as="h2"
      :label="messages.unreachableTitle"
      :description="messages.unreachableDescription"
      :ui="{ label: ui.title(), description: ui.description() }"
    >
      <template #icon>
        <icon-lucide-wifi-off class="size-5" />
      </template>
      <template #action>
        <AppButton
          color="neutral"
          variant="ghost"
          data-test-id="room-screen-leave"
          @click="emit('leave')"
        >
          {{ messages.leave }}
        </AppButton>
      </template>
    </AppPlaceholder>

    <AppPlaceholder
      v-else
      size="page"
      label-as="h2"
      :label="messages.waitingTitle"
      :description="`${messages.waitingDescription} ${messages.waitingOpensAutomatically}`"
      :ui="{ label: ui.title(), description: ui.description() }"
    >
      <template #icon>
        <icon-lucide-users class="size-5" />
      </template>
      <ul :class="ui.steps()">
        <li>{{ messages.waitingAskSharer }}</li>
        <li>{{ messages.waitingCheckLink }}</li>
      </ul>
      <p v-if="othersWaiting.length" :class="ui.othersWaiting()" data-test-id="room-others-waiting">
        {{ messages.othersWaiting({ names: othersWaiting.join(', ') }) }}
      </p>
      <template #action>
        <div :class="ui.actions()">
          <div :class="ui.buttons()">
            <AppButton
              color="neutral"
              variant="outline"
              data-test-id="room-screen-copy-link"
              @click="emit('copyLink')"
            >
              <template #leading>
                <icon-lucide-check v-if="copied" class="size-3" />
                <icon-lucide-copy v-else class="size-3" />
              </template>
              {{ copied ? messages.linkCopied : messages.copyLink }}
            </AppButton>
            <AppButton
              color="neutral"
              variant="ghost"
              data-test-id="room-screen-leave"
              @click="emit('leave')"
            >
              {{ messages.leave }}
            </AppButton>
          </div>
          <RoomNameLine :name="name" @rename="emit('rename', $event)" />
          <p v-if="desktopLink" :class="ui.footnote()">
            <a :href="desktopLink" :class="ui.link()" data-test-id="room-screen-open-desktop">
              {{ messages.openInDesktopApp }}
            </a>
            <template v-if="downloadURL">
              <span aria-hidden="true">·</span>
              <a
                :href="downloadURL"
                target="_blank"
                rel="noopener noreferrer"
                :class="ui.link()"
                data-test-id="room-screen-download-desktop"
              >
                {{ messages.downloadDesktopApp }}
              </a>
            </template>
          </p>
        </div>
      </template>
    </AppPlaceholder>
  </div>
</template>
