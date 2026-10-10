<script setup lang="ts">
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'

/**
 * How a person signs in to this Cloud server and how they prove it’s them: linked accounts,
 * a password, an authenticator app with recovery codes, and passkeys.
 */
const {
  methods,
  password,
  authenticator,
  passkeys,
  adminRequiresTwoFactor = false
} = defineProps<{
  methods: { provider: 'google' | 'apple'; linked: boolean; email?: string }[]
  password: { set: boolean; changedAgo?: string }
  authenticator: { on: boolean; recoveryCodesLeft?: number }
  passkeys: { id: string; name: string; addedAgo: string; lastUsedAgo?: string }[]
  /** Deployment administrators must keep a second step on. */
  adminRequiresTwoFactor?: boolean
}>()
const emit = defineEmits<{
  link: [provider: 'google' | 'apple']
  unlink: [provider: 'google' | 'apple']
  changePassword: []
  setUpAuthenticator: []
  turnOffAuthenticator: []
  newRecoveryCodes: []
  addPasskey: []
  removePasskey: [id: string]
}>()

const providerLabels = { google: 'Google', apple: 'Apple' } as const
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <AppAlert
      v-if="adminRequiresTwoFactor && !authenticator.on && passkeys.length === 0"
      tone="warning"
      heading="Turn on a second sign-in step"
      description="This server requires administrators to use an authenticator app or a passkey before opening the console."
    />

    <SettingsSection>
      <template #title>Ways to sign in</template>
      <template #description>Keep at least one, so you can always get back in.</template>
      <SettingsGroup>
        <SettingsRow
          v-for="method in methods"
          :key="method.provider"
          :label="providerLabels[method.provider]"
          :description="method.linked ? method.email : 'Not linked'"
        >
          <AppButton
            v-if="method.linked"
            size="sm"
            variant="ghost"
            @click="emit('unlink', method.provider)"
          >
            Unlink
          </AppButton>
          <AppButton v-else size="sm" variant="outline" @click="emit('link', method.provider)">
            Link
          </AppButton>
        </SettingsRow>
        <SettingsRow
          label="Password"
          :description="
            password.set
              ? `Changed ${password.changedAgo ?? 'a while ago'}`
              : 'Sign in with email and a password too'
          "
        >
          <AppButton size="sm" variant="outline" @click="emit('changePassword')">
            {{ password.set ? 'Change' : 'Set password' }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>Two-step sign-in</template>
      <template #description
        >Ask for a second proof after your password or linked account.</template
      >
      <SettingsGroup>
        <SettingsRow label="Authenticator app">
          <template #description>
            <p class="mt-1 flex items-center gap-1.5 text-xs text-muted">
              <AppBadge v-if="authenticator.on">On</AppBadge>
              {{
                authenticator.on
                  ? `${authenticator.recoveryCodesLeft ?? 0} recovery codes left`
                  : 'Codes from an app such as 1Password or Google Authenticator'
              }}
            </p>
          </template>
          <div v-if="authenticator.on" class="flex items-center gap-1">
            <AppButton size="sm" variant="ghost" @click="emit('newRecoveryCodes')">
              New recovery codes
            </AppButton>
            <AppButton size="sm" variant="ghost" @click="emit('turnOffAuthenticator')">
              Turn off
            </AppButton>
          </div>
          <AppButton v-else size="sm" variant="outline" @click="emit('setUpAuthenticator')">
            Set up
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection>
      <template #title>Passkeys</template>
      <template #description>Sign in with your device’s screen lock instead of a code.</template>
      <template #actions>
        <AppButton size="sm" variant="outline" @click="emit('addPasskey')">
          <template #leading><icon-lucide-plus class="size-3.5" /></template>
          Add passkey
        </AppButton>
      </template>
      <SettingsGroup v-if="passkeys.length">
        <SettingsRow
          v-for="passkey in passkeys"
          :key="passkey.id"
          :label="passkey.name"
          :description="`Added ${passkey.addedAgo}${passkey.lastUsedAgo ? ` · Last used ${passkey.lastUsedAgo}` : ''}`"
        >
          <AppButton size="sm" variant="ghost" @click="emit('removePasskey', passkey.id)">
            Remove
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
      <p v-else class="rounded border border-dashed border-border px-3 py-3 text-xs text-muted">
        No passkeys yet.
      </p>
    </SettingsSection>
  </div>
</template>
