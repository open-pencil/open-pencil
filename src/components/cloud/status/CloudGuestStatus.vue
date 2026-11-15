<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, ref } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppPopoverRoot from '@/components/ui/overlay/AppPopoverRoot.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import Tip from '@/components/ui/overlay/Tip.vue'
import cloudStatusTheme from '@/theme/cloud/status'

const cloudStatus = tv(cloudStatusTheme)

/**
 * A document opened from a link, beside its name, when it is view only: always for a guest
 * without an account, who may sign in to edit when the link lets people signed in edit, and for
 * anyone while the document's owner holds their whole storage allowance.
 */
const { canEditSignedIn = false, atStorageLimit = false } = defineProps<{
  canEditSignedIn?: boolean
  atStorageLimit?: boolean
}>()

const emit = defineEmits<{ signIn: [] }>()

const ui = cloudStatus()
const popover = usePopoverUI({ content: 'w-72 p-3' })
const popoverOpen = ref(false)
const t = useCloudMessages()
const label = computed(() => (atStorageLimit ? t.value.statusStorageFull : t.value.viewOnly))
const detail = computed(() => {
  if (atStorageLimit) return t.value.statusStorageFullDetail
  return canEditSignedIn ? t.value.statusGuestCanEditDetail : t.value.statusGuestDetail
})

function signIn() {
  popoverOpen.value = false
  emit('signIn')
}
</script>

<template>
  <AppPopoverRoot v-model:open="popoverOpen">
    <Tip :label="label" as-child>
      <PopoverTrigger :class="ui.trigger()" data-state-sync="view" :aria-label="label">
        <icon-lucide-hard-drive v-if="atStorageLimit" class="size-3.5" />
        <icon-lucide-eye v-else class="size-3.5" />
        <span :class="ui.triggerLabel()">{{ label }}</span>
      </PopoverTrigger>
    </Tip>
    <PopoverPortal>
      <PopoverContent side="bottom" align="start" :side-offset="6" :class="popover.content">
        <div :class="ui.header()">
          <span :class="ui.headerIcon()" data-state-sync="view">
            <icon-lucide-hard-drive v-if="atStorageLimit" class="size-4" />
            <icon-lucide-eye v-else class="size-4" />
          </span>
          <div class="min-w-0">
            <p :class="ui.title()">{{ label }}</p>
            <p :class="ui.detail()">{{ detail }}</p>
          </div>
        </div>
        <div v-if="canEditSignedIn && !atStorageLimit" :class="ui.actions()">
          <AppButton size="sm" color="primary" variant="solid" @click="signIn">
            {{ t.signInToEdit }}
          </AppButton>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </AppPopoverRoot>
</template>
