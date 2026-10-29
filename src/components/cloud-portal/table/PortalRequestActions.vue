<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import AppButton from '@/components/ui/button/AppButton.vue'

import type { AccessRequest } from '../types'
import PortalRowMenu from './PortalRowMenu.vue'
import { portalTable } from './ui'

/** What can be decided about an access request: approving it at hand, the rest in its menu. */
const { request, busy = false } = defineProps<{ request: AccessRequest; busy?: boolean }>()
const emit = defineEmits<{ approve: []; ask: [kind: 'reject' | 'revoke'] }>()

const ui = portalTable()
const messages = useCloudPortalMessages()
const items = computed(() => {
  if (request.status === 'pending')
    return [{ action: 'reject' as const, label: messages.value.decline }]
  if (request.status === 'approved') {
    return [{ action: 'revoke' as const, label: messages.value.removeAccess }]
  }
  return []
})
</script>

<template>
  <div :class="ui.actions()">
    <AppButton
      v-if="request.status === 'pending'"
      size="sm"
      color="primary"
      variant="solid"
      :loading="busy"
      @click="emit('approve')"
    >
      {{ messages.approve }}
    </AppButton>
    <PortalRowMenu
      v-if="items.length"
      :label="messages.actionsFor({ name: request.name ?? request.email })"
      :items="items"
      :disabled="busy"
      @select="(kind) => emit('ask', kind)"
    />
  </div>
</template>
