<script setup lang="ts">
import { ref } from 'vue'

import { useCollaborationMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import { roomScreen } from '@/theme/collaboration/room-screen'

/**
 * What a room tab shows instead of its canvas until the room's document arrives: briefly that it
 * is joining, then why nothing is here yet and what to do. Nothing on it can edit the document.
 */
const {
  status,
  name,
  copied = false,
  nameHint = null,
  desktopLink = null
} = defineProps<{
  status: 'joining' | 'waiting'
  /** The person's name in the room, generated until they set one. */
  name: string
  copied?: boolean
  /** Shown while the person is in the room under a generated name. */
  nameHint?: string | null
  /** An `openpencil://join` link, offered in desktop browsers. */
  desktopLink?: string | null
}>()

const emit = defineEmits<{
  copyLink: []
  leave: []
  rename: [name: string]
}>()

const messages = useCollaborationMessages()
const nameDraft = ref('')

function rename() {
  const next = nameDraft.value.trim()
  if (next && next !== name) emit('rename', next)
}
const ui = roomScreen()
</script>

<template>
  <div :class="ui.root()" data-test-id="room-screen" :data-status="status">
    <section
      :class="ui.card()"
      role="status"
      aria-live="polite"
      :aria-busy="status === 'joining'"
      aria-labelledby="room-screen-title"
    >
      <icon-lucide-loader-circle
        v-if="status === 'joining'"
        :class="ui.spinner()"
        aria-hidden="true"
      />
      <icon-lucide-users v-else :class="ui.icon()" aria-hidden="true" />

      <template v-if="status === 'joining'">
        <h2 id="room-screen-title" :class="ui.title()">{{ messages.joiningTitle }}</h2>
        <p :class="ui.body()">{{ messages.joiningDescription }}</p>
      </template>

      <template v-else>
        <h2 id="room-screen-title" :class="ui.title()">{{ messages.waitingTitle }}</h2>
        <p :class="ui.body()">{{ messages.waitingDescription }}</p>
        <ul :class="ui.steps()">
          <li>{{ messages.waitingAskSharer }}</li>
          <li>{{ messages.waitingCheckLink }}</li>
        </ul>
        <p :class="ui.body()">{{ messages.waitingOpensAutomatically }}</p>
      </template>

      <div :class="ui.name()">
        <label for="room-screen-name-input" :class="ui.label()">{{ messages.yourName }}</label>
        <AppInput
          id="room-screen-name-input"
          v-model="nameDraft"
          data-test-id="room-screen-name-input"
          :placeholder="name"
          @enter="rename"
          @change="rename"
        />
        <p v-if="nameHint" :class="ui.hint()" data-test-id="room-name-hint">{{ nameHint }}</p>
      </div>

      <div :class="ui.actions()">
        <AppButton
          color="primary"
          variant="solid"
          data-test-id="room-screen-copy-link"
          @click="emit('copyLink')"
        >
          <template #leading>
            <icon-lucide-check v-if="copied" class="size-3" />
            <icon-lucide-copy v-else class="size-3" />
          </template>
          {{ copied ? messages.linkCopied : messages.copyLink }}
        </AppButton>
        <AppButton variant="outline" data-test-id="room-screen-leave" @click="emit('leave')">
          {{ messages.leave }}
        </AppButton>
        <a
          v-if="desktopLink"
          :href="desktopLink"
          :class="ui.link()"
          data-test-id="room-screen-open-desktop"
        >
          {{ messages.openInDesktopApp }}
        </a>
      </div>
    </section>
  </div>
</template>
