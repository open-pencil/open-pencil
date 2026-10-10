<script setup lang="ts">
import AppButton from '@/components/ui/button/AppButton.vue'
import { portalList } from '@/theme/cloud-portal/list'

import type { PortalEmail } from '../types'

/** Email the server sends, such as invitations and sign-in links, and whether it went out. */
const { emails } = defineProps<{ emails: PortalEmail[] }>()
const emit = defineEmits<{ retry: [id: string] }>()

const ui = portalList()
const tones = { sent: 'success', waiting: 'neutral', failed: 'error' } as const
const labels = { sent: 'Sent', waiting: 'Waiting', failed: 'Failed' }
</script>

<template>
  <ul :class="ui.list()">
    <li v-for="email in emails" :key="email.id" :class="ui.row()">
      <icon-lucide-mail class="size-4 shrink-0 text-muted" />
      <div :class="ui.body()">
        <p :class="ui.title()">{{ email.subject }}</p>
        <p :class="ui.detail()">
          To {{ email.recipient
          }}{{
            email.error
              ? ` · ${email.error}`
              : email.attempts > 1
                ? ` · ${email.attempts} attempts`
                : ''
          }}
        </p>
      </div>
      <span :class="ui.status()" :data-tone="tones[email.status]">{{ labels[email.status] }}</span>
      <span :class="ui.meta()">{{ email.when }}</span>
      <div :class="ui.actions()" class="w-16 justify-end">
        <AppButton
          v-if="email.status === 'failed'"
          size="sm"
          variant="outline"
          @click="emit('retry', email.id)"
        >
          Retry
        </AppButton>
      </div>
    </li>
  </ul>
</template>
