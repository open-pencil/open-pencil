<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'

import type { PortalLinkedMethod, PortalSignInMethod } from '../types'

/**
 * How a person signs in to this Cloud server and how they prove it’s them: linked accounts,
 * a password, an authenticator app with recovery codes, and passkeys.
 */
const {
  methods,
  linkable,
  authenticator,
  passkeys,
  passkeysAvailable = true,
  twoStepRequired = false,
  busy = false
} = defineProps<{
  methods: PortalLinkedMethod[]
  /** Social providers the server offers that are not linked yet. */
  linkable: PortalSignInMethod[]
  authenticator: { available: boolean; on: boolean }
  passkeys: { id: string; name: string | null; addedOn: string }[]
  passkeysAvailable?: boolean
  /** The server requires a second step for this account, and none is on yet. */
  twoStepRequired?: boolean
  busy?: boolean
}>()
const emit = defineEmits<{
  link: [provider: PortalSignInMethod]
  unlink: [methodId: string]
  changePassword: []
  setUpAuthenticator: []
  turnOffAuthenticator: []
  newRecoveryCodes: []
  addPasskey: []
  removePasskey: [id: string]
}>()

const messages = useCloudPortalMessages()
const providerLabel = (provider: PortalSignInMethod) =>
  provider === 'google' ? messages.value.providerGoogle : messages.value.providerApple
const social = computed(() =>
  methods.flatMap((method) =>
    method.provider === 'credential' ? [] : [{ ...method, provider: method.provider }]
  )
)
const password = computed(() => methods.find((method) => method.provider === 'credential') ?? null)
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <AppAlert
      v-if="twoStepRequired"
      tone="warning"
      :heading="messages.adminTwoStepTitle"
      :description="messages.adminTwoStepDescription"
    />

    <SettingsSection>
      <template #title>{{ messages.waysToSignIn }}</template>
      <template #description>{{ messages.waysToSignInDescription }}</template>
      <SettingsGroup>
        <SettingsRow
          v-for="method in social"
          :key="method.id"
          :label="providerLabel(method.provider)"
          :description="messages.linkedOn({ date: method.linkedOn })"
        >
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="busy || !method.canUnlink"
            @click="emit('unlink', method.id)"
          >
            {{ messages.unlink }}
          </AppButton>
        </SettingsRow>
        <SettingsRow
          v-for="provider in linkable"
          :key="provider"
          :label="providerLabel(provider)"
          :description="messages.notLinked"
        >
          <AppButton size="sm" variant="outline" :disabled="busy" @click="emit('link', provider)">
            {{ messages.link }}
          </AppButton>
        </SettingsRow>
        <SettingsRow
          :label="messages.password"
          :description="password ? messages.passwordSet : messages.passwordNotSet"
        >
          <AppButton size="sm" variant="outline" :disabled="busy" @click="emit('changePassword')">
            {{ password ? messages.change : messages.setPassword }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection v-if="authenticator.available">
      <template #title>{{ messages.twoStepSection }}</template>
      <template #description>{{ messages.twoStepSectionDescription }}</template>
      <SettingsGroup>
        <SettingsRow :label="messages.authenticatorApp">
          <template #description>
            <p class="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <AppBadge v-if="authenticator.on">{{ messages.authenticatorOn }}</AppBadge>
              <template v-else>{{ messages.authenticatorOff }}</template>
            </p>
          </template>
          <div v-if="authenticator.on" class="flex items-center gap-1">
            <AppButton size="sm" variant="ghost" :disabled="busy" @click="emit('newRecoveryCodes')">
              {{ messages.newRecoveryCodes }}
            </AppButton>
            <AppButton
              size="sm"
              variant="ghost"
              :disabled="busy"
              @click="emit('turnOffAuthenticator')"
            >
              {{ messages.turnOff }}
            </AppButton>
          </div>
          <AppButton
            v-else
            size="sm"
            variant="outline"
            :disabled="busy"
            @click="emit('setUpAuthenticator')"
          >
            {{ messages.setUp }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection v-if="passkeysAvailable">
      <template #title>{{ messages.passkeys }}</template>
      <template #description>{{ messages.passkeysDescription }}</template>
      <template #actions>
        <AppButton size="sm" variant="outline" :disabled="busy" @click="emit('addPasskey')">
          <template #leading><icon-lucide-plus class="size-3.5" /></template>
          {{ messages.addPasskey }}
        </AppButton>
      </template>
      <SettingsGroup v-if="passkeys.length">
        <SettingsRow
          v-for="passkey in passkeys"
          :key="passkey.id"
          :label="passkey.name ?? messages.unnamedPasskey"
          :description="messages.passkeyAdded({ date: passkey.addedOn })"
        >
          <AppButton
            size="sm"
            variant="ghost"
            :disabled="busy"
            @click="emit('removePasskey', passkey.id)"
          >
            {{ messages.remove }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
      <p v-else class="rounded border border-dashed border-border px-3 py-3 text-xs text-muted">
        {{ messages.noPasskeys }}
      </p>
    </SettingsSection>
  </div>
</template>
