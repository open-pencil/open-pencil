<script setup lang="ts">
import { AppButton, AppInput } from '@open-pencil/ui'
import QRCode from 'qrcode'
import { computed, ref, watch } from 'vue'

import type { CloudDiscovery } from '@open-pencil/cloud/contract'

import { useCloudI18n } from '#admin/i18n/use'
import { useMFA } from './useMFA'

const { discovery } = defineProps<{ discovery?: CloudDiscovery }>()
const messages = useCloudI18n()
const passkeyName = ref('')
const password = ref('')
const qrCode = ref('')
const backupCodesAcknowledged = ref(false)
const {
  addPasskey,
  backupCodes,
  deletePasskey,
  enableTOTP,
  error,
  passkeys,
  setupCode,
  status,
  totpURI,
  verifyTOTP
} = useMFA(() => discovery)

watch(totpURI, async (value) => {
  qrCode.value = value ? await QRCode.toDataURL(value, { margin: 1, width: 220 }) : ''
})
const needsPassword = computed(() => true)
</script>

<template>
  <section class="mt-6 rounded-xl border border-border bg-panel p-6">
    <h2 class="m-0 text-lg font-semibold">{{ messages.account.value.mfaTitle }}</h2>
    <p class="mt-2 text-xs leading-5 text-muted">{{ messages.account.value.mfaDescription }}</p>
    <p v-if="status.data.value?.mfa.assured" class="text-xs text-success" role="status">
      {{ messages.account.value.mfaVerified }}
    </p>
    <p v-if="error" class="text-xs text-error" role="alert">
      {{ messages.errors.value.mfaFailed }}
    </p>

    <div v-if="status.data.value?.mfa.totpAvailable" class="mt-5 border-t border-border pt-5">
      <h3 class="m-0 text-sm font-semibold">{{ messages.account.value.authenticatorApp }}</h3>
      <template v-if="totpURI">
        <p class="text-xs text-muted">{{ messages.account.value.authenticatorSetup }}</p>
        <img
          v-if="qrCode"
          :src="qrCode"
          :alt="messages.account.value.authenticatorQRCode"
          class="mx-auto size-52 rounded-md bg-white p-2"
        />
        <details class="mt-3 text-xs text-muted">
          <summary>{{ messages.account.value.manualSetup }}</summary>
          <code class="mt-2 block overflow-x-auto rounded-md bg-canvas p-3">{{ totpURI }}</code>
        </details>
        <label class="mt-3 grid gap-1 text-xs text-muted">
          {{ messages.account.value.verificationCode }}
          <AppInput v-model="setupCode" inputmode="numeric" autocomplete="one-time-code" />
        </label>
        <AppButton
          class="mt-3"
          color="primary"
          variant="solid"
          :loading="verifyTOTP.isPending.value"
          @click="verifyTOTP.mutate()"
        >
          {{ messages.account.value.verifyMFA }}
        </AppButton>
      </template>
      <template v-else>
        <label v-if="needsPassword" class="mt-3 grid gap-1 text-xs text-muted">
          {{ messages.account.value.currentPassword }}
          <AppInput v-model="password" type="password" autocomplete="current-password" />
        </label>
        <AppButton
          class="mt-3"
          variant="outline"
          :loading="enableTOTP.isPending.value"
          @click="enableTOTP.mutate(password || undefined)"
        >
          {{ messages.account.value.setUpAuthenticator }}
        </AppButton>
      </template>
    </div>

    <div
      v-if="backupCodes.length"
      class="mt-5 rounded-lg border border-warning/40 bg-warning/5 p-4"
    >
      <h3 class="m-0 text-sm font-semibold">{{ messages.account.value.recoveryCodes }}</h3>
      <p class="text-xs text-muted">{{ messages.account.value.recoveryCodesDescription }}</p>
      <ul class="grid grid-cols-2 gap-2 p-0 font-mono text-xs">
        <li v-for="code in backupCodes" :key="code" class="list-none">{{ code }}</li>
      </ul>
      <label class="mt-3 flex items-start gap-2 text-xs text-muted">
        <input v-model="backupCodesAcknowledged" type="checkbox" class="mt-0.5 accent-accent" />
        {{ messages.account.value.recoveryCodesAcknowledgement }}
      </label>
      <AppButton
        class="mt-3"
        variant="outline"
        :disabled="!backupCodesAcknowledged"
        @click="backupCodes = []"
      >
        {{ messages.account.value.recoveryCodesSaved }}
      </AppButton>
    </div>

    <div v-if="status.data.value?.mfa.passkeysAvailable" class="mt-5 border-t border-border pt-5">
      <h3 class="m-0 text-sm font-semibold">{{ messages.account.value.passkeys }}</h3>
      <div
        v-for="item in passkeys.data.value?.passkeys ?? []"
        :key="item.id"
        class="mt-3 flex items-center justify-between rounded-md border border-border px-3 py-2"
      >
        <span class="text-xs">{{ item.name || messages.account.value.unnamedPasskey }}</span>
        <AppButton size="xs" variant="ghost" @click="deletePasskey.mutate(item.id)">
          {{ messages.account.value.removePasskey }}
        </AppButton>
      </div>
      <div class="mt-3 flex gap-2">
        <AppInput v-model="passkeyName" :placeholder="messages.account.value.passkeyName" />
        <AppButton
          variant="outline"
          :loading="addPasskey.isPending.value"
          @click="addPasskey.mutate(passkeyName || undefined)"
        >
          {{ messages.account.value.addPasskey }}
        </AppButton>
      </div>
    </div>
  </section>
</template>
