<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed, useId } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { ReportSendFailure } from '@/app/reports/send'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppCheckboxCard from '@/components/ui/toggle/AppCheckboxCard.vue'
import reportsTheme from '@/theme/reports'

const {
  kind,
  emailInvalid = false,
  hasDocument = false,
  preparingDocument = false,
  documentFailed = false,
  preview,
  canSend,
  sending = false,
  failure = null
} = defineProps<{
  kind: 'error' | 'problem'
  emailInvalid?: boolean
  /** Whether the active tab holds a document to attach. */
  hasDocument?: boolean
  preparingDocument?: boolean
  documentFailed?: boolean
  /** The exact body that would be sent. */
  preview: string
  canSend: boolean
  sending?: boolean
  failure?: ReportSendFailure | null
}>()

const emit = defineEmits<{ send: [] }>()

const open = defineModel<boolean>('open', { default: false })
const note = defineModel<string>('note', { default: '' })
const email = defineModel<string>('email', { default: '' })
const includeActivity = defineModel<boolean>('includeActivity', { default: true })
const attachDocument = defineModel<boolean>('attachDocument', { default: false })

const { common, diagnostics: messages } = useI18n()
const ui = tv(reportsTheme)()
const id = useId()

const heading = computed(() =>
  kind === 'error' ? messages.value.reportErrorTitle : messages.value.reportProblemTitle
)
const description = computed(() =>
  kind === 'error' ? messages.value.reportErrorDescription : messages.value.reportProblemDescription
)
</script>

<template>
  <AppDialogRoot v-model:open="open" size="md" data-test-id="report-dialog">
    <AppDialogHeader :heading="heading" :description="description" />
    <form novalidate class="flex min-h-0 flex-1 flex-col" @submit.prevent="emit('send')">
      <AppDialogBody :ui="{ body: ui.body() }">
        <div :class="ui.field()">
          <label :for="`${id}-note`" :class="ui.label()">
            {{ kind === 'error' ? messages.reportNoteError : messages.reportNoteProblem }}
          </label>
          <AppTextarea
            :id="`${id}-note`"
            v-model="note"
            :rows="4"
            :placeholder="messages.reportNotePlaceholder"
            data-test-id="report-note"
          />
        </div>
        <div :class="ui.field()">
          <label :for="`${id}-email`" :class="ui.label()">{{ messages.reportEmail }}</label>
          <AppInput
            :id="`${id}-email`"
            v-model="email"
            type="email"
            size="md"
            :state="emailInvalid ? 'invalid' : 'idle'"
            :aria-invalid="emailInvalid"
            :aria-describedby="`${id}-email-hint`"
            autocomplete="email"
          />
          <p :id="`${id}-email-hint`" :class="ui.hint()">{{ messages.reportEmailHint }}</p>
        </div>
        <AppCheckboxCard
          v-model="includeActivity"
          :label="messages.reportActivity"
          :description="messages.reportActivityDescription"
        />
        <AppCheckboxCard
          v-if="hasDocument"
          v-model="attachDocument"
          :label="messages.reportDocument"
          :description="messages.reportDocumentDescription"
        />
        <AppCollapsible :label="messages.reportPreview">
          <pre :class="ui.preview()" data-test-id="report-preview">{{ preview }}</pre>
        </AppCollapsible>
        <AppAlert v-if="documentFailed" tone="error" :heading="messages.reportDocumentFailed" />
        <AppAlert
          v-if="failure"
          tone="error"
          :heading="failure === 'files' ? messages.reportFilesFailed : messages.reportFailed"
        />
      </AppDialogBody>
      <AppDialogFooter>
        <AppButton type="button" size="md" @click="open = false">{{ common.cancel }}</AppButton>
        <AppButton
          type="submit"
          size="md"
          color="primary"
          variant="solid"
          :loading="sending"
          :disabled="!canSend || preparingDocument"
          data-test-id="report-send"
        >
          {{ messages.reportSend }}
        </AppButton>
      </AppDialogFooter>
    </form>
  </AppDialogRoot>
</template>
