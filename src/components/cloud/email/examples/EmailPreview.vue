<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { ref } from 'vue'

import type { RenderedTransactionalEmail } from '@open-pencil/cloud/email'

import { AppTabsContent, AppTabsList, AppTabsRoot, AppTabsTrigger } from '@/components/ui/tabs'

/** An email as Cloud sends it: its subject, its HTML in a frame as a mail client shows it, and its text. */
const { render } = defineProps<{ render: () => Promise<RenderedTransactionalEmail> }>()

const email = computedAsync(() => render(), null)
const view = ref('html')
</script>

<template>
  <div v-if="email" class="flex max-w-3xl flex-col gap-3">
    <p class="text-sm">
      <span class="text-muted">Subject</span>
      <span class="ms-2 font-medium" data-test-id="email-subject">{{ email.subject }}</span>
    </p>
    <AppTabsRoot v-model="view" class="rounded-lg bg-panel">
      <AppTabsList label="Version">
        <AppTabsTrigger value="html">HTML</AppTabsTrigger>
        <AppTabsTrigger value="text">Plain text</AppTabsTrigger>
      </AppTabsList>
      <AppTabsContent value="html">
        <!-- A frame keeps the page's styles out, so the email shows only its own, as a mail client does. -->
        <iframe :srcdoc="email.html" aria-label="Email" class="h-200 w-full rounded-b-lg bg-white" />
      </AppTabsContent>
      <AppTabsContent value="text">
        <pre class="p-4 text-sm whitespace-pre-wrap">{{ email.text }}</pre>
      </AppTabsContent>
    </AppTabsRoot>
  </div>
</template>
