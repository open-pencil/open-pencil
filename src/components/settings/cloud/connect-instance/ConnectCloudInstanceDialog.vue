<script setup lang="ts">
import { computed, watch } from 'vue'
import { useCloudMessages, useCommonMessages } from '@open-pencil/vue'

import { OFFICIAL_OPENPENCIL_CLOUD_URL } from '@/app/integrations/storage/cloud/profiles'
import AppInput from '@/components/ui/AppInput.vue'
import { useButtonUI } from '@/components/ui/button'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'
import { useConnectCloudInstance } from './useConnectCloudInstance'

const cloudMessages = useCloudMessages()
const common = useCommonMessages()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{
  connectOfficial: []
  connectSelfHosted: [serverURL: string]
}>()
const flow = useConnectCloudInstance()
const verifiedHostname = computed(() => {
  try {
    return new globalThis.URL(flow.serverURL.value).hostname
  } catch {
    return flow.serverURL.value
  }
})
const primary = useButtonUI({ tone: 'accent', size: 'sm' })
const secondary = useButtonUI({ tone: 'ghost', size: 'sm', bordered: true })

function finishOfficial() {
  emit('connectOfficial')
  open.value = false
}

function finishSelfHosted() {
  emit('connectSelfHosted', flow.serverURL.value)
  open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) flow.reset()
})
</script>

<template>
  <AppDialogRoot v-model:open="open" size="sm" :aria-label="cloudMessages.connectDialogTitle">
    <AppDialogHeader :heading="cloudMessages.connectDialogTitle" :close-label="common.close" />
    <AppDialogBody class="space-y-3">
      <template v-if="flow.step.value === 'choose-kind'">
        <button
          type="button"
          class="w-full rounded border border-border p-3 text-left hover:bg-hover"
          @click="flow.selectOfficial"
        >
          <span class="block text-xs font-medium text-surface">OpenPencil Cloud</span>
          <span class="mt-1 block text-[10px] text-muted">{{ OFFICIAL_OPENPENCIL_CLOUD_URL }}</span>
          <span class="mt-1 block text-[10px] text-muted">{{
            cloudMessages.officialHostedService
          }}</span>
        </button>
        <button
          type="button"
          class="w-full rounded border border-border p-3 text-left hover:bg-hover"
          @click="flow.selectSelfHosted"
        >
          <span class="block text-xs font-medium text-surface">{{
            cloudMessages.enterInstanceURL
          }}</span>
          <span class="mt-1 block text-[10px] text-muted">
            {{ cloudMessages.selfHostedDescription }}
          </span>
        </button>
      </template>

      <template v-else-if="flow.step.value === 'enter-url' || flow.step.value === 'error'">
        <label class="flex flex-col gap-1 text-[10px] text-muted">
          {{ cloudMessages.serverURL }}
          <AppInput
            v-model="flow.serverURL.value"
            placeholder="https://pencil.example.com"
            :aria-label="cloudMessages.serverURL"
            size="sm"
            tone="panel"
            @enter="flow.verify"
          />
        </label>
        <p v-if="flow.error.value" class="text-[10px] text-danger" role="alert">
          {{ flow.error.value }}
        </p>
      </template>

      <div
        v-else-if="flow.step.value === 'discovering'"
        class="py-6 text-center text-xs text-muted"
      >
        {{ cloudMessages.verifyingInstance }}
      </div>

      <template v-else-if="flow.discovery.value">
        <div class="rounded border border-border bg-panel-field p-3">
          <p class="text-[10px] font-medium text-accent">{{ cloudMessages.instanceConnected }}</p>
          <p class="text-xs font-medium text-surface">
            {{ verifiedHostname }}
          </p>
          <p class="mt-1 text-[10px] text-muted">{{ cloudMessages.signInNext }}</p>
          <p class="mt-1 text-[10px] text-muted">
            {{
              flow.discovery.value.deployment === 'official'
                ? cloudMessages.official
                : cloudMessages.selfHosted
            }}
            ·
            {{ cloudMessages.protocolVersion({ version: flow.discovery.value.protocolVersion }) }}
          </p>
        </div>
        <ul class="space-y-1 text-[10px] text-muted">
          <li>✓ {{ cloudMessages.documentStorage }}</li>
          <li>✓ {{ cloudMessages.workspaces }}</li>
          <li :class="flow.discovery.value.capabilities.collaboration ? '' : 'text-warning'">
            {{ flow.discovery.value.capabilities.collaboration ? '✓' : '—' }}
            {{ cloudMessages.collaboration }}
          </li>
        </ul>
      </template>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        v-if="flow.step.value !== 'choose-kind' && flow.kind.value !== 'official'"
        type="button"
        :class="secondary.base"
        @click="flow.step.value = 'choose-kind'"
      >
        {{ cloudMessages.back }}
      </button>
      <button
        v-if="flow.step.value === 'enter-url' || flow.step.value === 'error'"
        type="button"
        :class="primary.base"
        :disabled="!flow.serverURL.value.trim()"
        @click="flow.verify"
      >
        {{ cloudMessages.verify }}
      </button>
      <button
        v-if="flow.step.value === 'ready'"
        type="button"
        :class="primary.base"
        :disabled="!flow.canConfirm.value"
        @click="flow.kind.value === 'official' ? finishOfficial() : finishSelfHosted()"
      >
        {{ cloudMessages.connect }}
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
