<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { useReportDialog } from '@/app/reports/dialog'
import { reportDialogOpen } from '@/app/reports/state'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import AppTextarea from '@/components/ui/input/AppTextarea.vue'
import AppCheckboxCard from '@/components/ui/toggle/AppCheckboxCard.vue'

const { common, diagnostics: messages } = useI18n()
const {
  kind,
  note,
  email,
  emailInvalid,
  includeActivity,
  attachDocument,
  hasDocument,
  preparingDocument,
  documentFailed,
  report,
  preview,
  sending,
  failure,
  send
} = useReportDialog()

const heading = computed(() =>
  kind.value === 'error' ? messages.value.reportErrorTitle : messages.value.reportProblemTitle
)
const description = computed(() =>
  kind.value === 'error'
    ? messages.value.reportErrorDescription
    : messages.value.reportProblemDescription
)
</script>

<template>
  <AppDialogRoot v-model:open="reportDialogOpen" size="md" data-test-id="report-dialog">
    <AppDialogHeader :heading="heading" :description="description" />
    <form
      id="report-form"
      class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
      @submit.prevent="send"
    >
      <label class="flex flex-col gap-1.5 text-xs text-muted">
        {{ kind === 'error' ? messages.reportNoteError : messages.reportNoteProblem }}
        <AppTextarea
          v-model="note"
          :rows="4"
          :placeholder="messages.reportNotePlaceholder"
          data-test-id="report-note"
        />
      </label>
      <label class="flex flex-col gap-1.5 text-xs text-muted">
        {{ messages.reportEmail }}
        <AppInput
          v-model="email"
          type="email"
          size="md"
          :state="emailInvalid ? 'invalid' : 'idle'"
          :aria-invalid="emailInvalid"
          autocomplete="email"
        />
        <span>{{ messages.reportEmailHint }}</span>
      </label>
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
        <pre
          class="max-h-64 overflow-auto rounded-md border border-border bg-input p-2 font-mono text-3xs whitespace-pre-wrap text-surface"
          data-test-id="report-preview"
          >{{ preview }}</pre>
      </AppCollapsible>
      <AppAlert v-if="documentFailed" tone="error" :heading="messages.reportDocumentFailed" />
      <AppAlert
        v-if="failure"
        tone="error"
        :heading="failure === 'files' ? messages.reportFilesFailed : messages.reportFailed"
      />
    </form>
    <AppDialogFooter>
      <AppButton size="md" @click="reportDialogOpen = false">{{ common.cancel }}</AppButton>
      <AppButton
        type="submit"
        form="report-form"
        size="md"
        color="primary"
        variant="solid"
        :disabled="!report || sending || preparingDocument"
        data-test-id="report-send"
      >
        {{ sending ? messages.reportSending : messages.reportSend }}
      </AppButton>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
