<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, useId } from 'vue'

import type { CommentEmailSetting } from '@open-pencil/cloud/contract'
import { useMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { portalToast } from '@/app/cloud-portal/toast'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import theme from '@/theme/cloud-portal/notifications'

import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'

/** Which comments the signed-in account hears about by email; a choice saves at once. */
const portal = usePortal()
const messages = useMessages('cloud/portal')
const ui = tv(theme)()
const headingId = useId()

const settings = usePortalLoad(() => portal.api.notificationSettings(), null)
const saving = usePortalAction(async (commentEmails: CommentEmailSetting) => {
  settings.data.value = await portal.api.setNotificationSettings({ commentEmails })
  portalToast.info(messages.value.notificationsSaved)
})

const options = computed(() => {
  const t = messages.value
  return [
    { value: 'all', label: t.commentEmailsAll, description: t.commentEmailsAllDescription },
    {
      value: 'mentions',
      label: t.commentEmailsMentions,
      description: t.commentEmailsMentionsDescription
    },
    { value: 'off', label: t.commentEmailsOff, description: t.commentEmailsOffDescription }
  ] satisfies { value: CommentEmailSetting; label: string; description: string }[]
})

const chosen = computed({
  get: () => settings.data.value?.commentEmails,
  set: (value) => {
    if (value && value !== settings.data.value?.commentEmails) void saving.run(value)
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PortalLoadAlert
      v-if="settings.error.value"
      :error="settings.error.value"
      @retry="settings.reload()"
    />
    <AppAlert
      v-if="saving.error.value"
      tone="error"
      :heading="messages.errorTitle"
      :description="saving.error.value"
    />
    <PortalPageSkeleton v-if="settings.status.value === 'loading'" :groups="[3]" />
    <section v-else-if="settings.data.value" :class="ui.section()">
      <h2 :id="headingId" :class="ui.heading()">{{ messages.commentEmails }}</h2>
      <RadioGroupRoot
        v-model="chosen"
        :aria-labelledby="headingId"
        :disabled="saving.busy.value || settings.loading.value"
        :class="ui.options()"
      >
        <RadioGroupItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :class="ui.option()"
        >
          <span :class="ui.optionMark()" aria-hidden="true" />
          <span class="min-w-0">
            <span :class="ui.optionLabel()">{{ option.label }}</span>
            <span :class="ui.optionDescription()">{{ option.description }}</span>
          </span>
        </RadioGroupItem>
      </RadioGroupRoot>
    </section>
  </div>
</template>
