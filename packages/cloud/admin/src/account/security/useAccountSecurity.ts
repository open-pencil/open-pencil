import { cloudAdminAPI } from '#admin/api/client'
import { cloudQueryKeys } from '#admin/app/query/keys'
import { authenticationMethodsQueryOptions, discoveryQueryOptions } from '#admin/app/query/options'
import { useCloudI18n } from '#admin/i18n/use'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'

import type { CloudAuthenticationMethod } from '@open-pencil/cloud/contract'

import {
  AccountSecurityError,
  changeAccountPassword,
  startAccountSocialLink,
  unlinkAccountMethod
} from './service'

export function useAccountSecurity() {
  const messages = useCloudI18n()
  const queryClient = useQueryClient()
  const methods = useQuery(authenticationMethodsQueryOptions())
  const discovery = useQuery(discoveryQueryOptions())
  const currentPassword = ref('')
  const newPassword = ref('')
  const confirmation = ref('')
  const formError = ref('')
  const passwordChanged = ref(false)
  const addPasswordSent = ref(false)
  const pendingUnlinkMethod = ref<CloudAuthenticationMethod>()
  const hasPassword = computed(() =>
    methods.data.value?.methods.some((method) => method.provider === 'credential')
  )
  const minimumLength = computed(
    () => discovery.data.value?.authentication.emailPassword?.minimumPasswordLength ?? 15
  )

  function providerLabel(provider: CloudAuthenticationMethod['provider']): string {
    if (provider === 'credential') return messages.account.value.passwordMethod
    return provider === 'google'
      ? messages.account.value.googleMethod
      : messages.account.value.appleMethod
  }

  function errorMessage(error: unknown): string {
    if (!(error instanceof AccountSecurityError)) return messages.errors.value.credentialUnknown
    if (error.code === 'current_password_invalid') {
      return messages.errors.value.currentPasswordInvalid
    }
    if (error.code === 'password_too_short') {
      return messages.errors.value.passwordTooShort({ count: minimumLength.value })
    }
    if (error.code === 'password_too_long') return messages.errors.value.passwordTooLong
    if (error.code === 'last_method') return messages.errors.value.lastAuthenticationMethod
    if (error.code === 'session_not_fresh') return messages.errors.value.sessionNotFresh
    return messages.errors.value.credentialUnknown
  }

  const changePassword = useMutation({
    mutationFn: () => changeAccountPassword(currentPassword.value, newPassword.value),
    onSuccess() {
      currentPassword.value = ''
      newPassword.value = ''
      confirmation.value = ''
      passwordChanged.value = true
    },
    onError(error) {
      formError.value = errorMessage(error)
    }
  })
  const unlink = useMutation({
    mutationFn: unlinkAccountMethod,
    async onSuccess() {
      pendingUnlinkMethod.value = undefined
      await queryClient.invalidateQueries({ queryKey: cloudQueryKeys.authenticationMethods })
    },
    onError(error) {
      formError.value = errorMessage(error)
    }
  })

  async function submitPassword(): Promise<void> {
    formError.value = ''
    passwordChanged.value = false
    if (newPassword.value !== confirmation.value) {
      formError.value = messages.errors.value.passwordMismatch
      return
    }
    await changePassword.mutateAsync().catch(() => undefined)
  }

  async function addPassword(): Promise<void> {
    const email = queryClient.getQueryData<{ user: { email: string } }>(cloudQueryKeys.account)
      ?.user.email
    if (!email) return
    try {
      await cloudAdminAPI.requestPasswordReset(
        email,
        new URL('/auth/reset-password', globalThis.location.origin).href
      )
      passwordChanged.value = false
      addPasswordSent.value = true
      formError.value = ''
    } catch (error) {
      formError.value = errorMessage(error)
    }
  }

  function linkProvider(provider: 'google' | 'apple'): void {
    const callbackURL = new URL('/app/account/security?linked=1', globalThis.location.origin).href
    void startAccountSocialLink(provider, callbackURL).catch((error) => {
      formError.value = errorMessage(error)
    })
  }

  return {
    addPassword,
    addPasswordSent,
    changePassword,
    confirmation,
    currentPassword,
    discovery,
    formError,
    hasPassword,
    linkProvider,
    messages,
    methods,
    minimumLength,
    newPassword,
    passwordChanged,
    pendingUnlinkMethod,
    providerLabel,
    submitPassword,
    unlink
  }
}
