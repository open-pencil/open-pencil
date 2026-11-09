<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'
import AppPopoverRoot from '@/components/ui/overlay/AppPopoverRoot.vue'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import Tip from '@/components/ui/overlay/Tip.vue'
import cloudStatusTheme from '@/theme/cloud/status'

const cloudStatus = tv(cloudStatusTheme)

/**
 * A document opened from a link without an account, beside its name: always view only, and,
 * when the link lets people signed in edit, the way to sign in and edit it.
 */
const { canEditSignedIn = false } = defineProps<{ canEditSignedIn?: boolean }>()

const emit = defineEmits<{ signIn: [] }>()

const ui = cloudStatus()
const popover = usePopoverUI({ content: 'w-72 p-3' })
const popoverOpen = ref(false)
const t = useCloudMessages()

function signIn() {
  popoverOpen.value = false
  emit('signIn')
}
</script>

<template>
  <AppPopoverRoot v-model:open="popoverOpen">
    <Tip :label="t.viewOnly" as-child>
      <PopoverTrigger :class="ui.trigger()" data-state-sync="view" :aria-label="t.viewOnly">
        <icon-lucide-eye class="size-3.5" />
        <span :class="ui.triggerLabel()">{{ t.viewOnly }}</span>
      </PopoverTrigger>
    </Tip>
    <PopoverPortal>
      <PopoverContent side="bottom" align="start" :side-offset="6" :class="popover.content">
        <div :class="ui.header()">
          <span :class="ui.headerIcon()" data-state-sync="view">
            <icon-lucide-eye class="size-4" />
          </span>
          <div class="min-w-0">
            <p :class="ui.title()">{{ t.viewOnly }}</p>
            <p :class="ui.detail()">
              {{ canEditSignedIn ? t.statusGuestCanEditDetail : t.statusGuestDetail }}
            </p>
          </div>
        </div>
        <div v-if="canEditSignedIn" :class="ui.actions()">
          <AppButton size="sm" color="primary" variant="solid" @click="signIn">
            {{ t.signInToEdit }}
          </AppButton>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </AppPopoverRoot>
</template>
