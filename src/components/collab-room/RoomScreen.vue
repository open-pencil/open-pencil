<script setup lang="ts">
import { useCollaborationMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppPlaceholder from '@/components/ui/feedback/AppPlaceholder.vue'
import { roomScreen } from '@/theme/collaboration/room-screen'

import RoomNameLine from './RoomNameLine.vue'

/**
 * What a room tab shows instead of the editor until the room's document arrives: briefly that it
 * is joining, then why nothing is here yet and what to do. Nothing on it can edit the document.
 */
const {
  status,
  name,
  copied = false,
  desktopLink = null,
  downloadURL = null
} = defineProps<{
  status: 'joining' | 'waiting'
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
</script>

<template>
  <div
    :class="ui.root()"
    data-test-id="room-screen"
    :data-status="status"
    role="status"
    aria-live="polite"
    :aria-busy="status === 'joining'"
  >
    <AppPlaceholder
      v-if="status === 'joining'"
      size="page"
      label-as="h2"
      :label="messages.joiningTitle"
      :description="messages.joiningDescription"
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
