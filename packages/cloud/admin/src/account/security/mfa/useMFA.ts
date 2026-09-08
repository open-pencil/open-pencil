import { cloudAdminAPI } from '#admin/api/client'
import { cloudQueryKeys } from '#admin/app/query/keys'
import { mfaStatusQueryOptions, passkeysQueryOptions } from '#admin/app/query/options'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'

import { createCloudAuthClient } from '@open-pencil/cloud/client'
import type { CloudDiscovery } from '@open-pencil/cloud/contract'

export function useMFA(discovery: () => CloudDiscovery | undefined) {
  const queryClient = useQueryClient()
  const status = useQuery(mfaStatusQueryOptions())
  const passkeys = useQuery(passkeysQueryOptions())
  const totpURI = ref('')
  const backupCodes = ref<string[]>([])
  const setupCode = ref('')
  const error = ref('')
  const enabled = computed(() => status.data.value?.mfa.enabled ?? false)

  const enableTOTP = useMutation({
    mutationFn: (password?: string) => cloudAdminAPI.enableTOTP(password),
    onSuccess(result) {
      totpURI.value = result.totpURI
      backupCodes.value = result.backupCodes
      error.value = ''
    },
    onError() {
      error.value = 'mfa_setup_failed'
    }
  })
  const verifyTOTP = useMutation({
    mutationFn: () => cloudAdminAPI.verifyTOTP(setupCode.value),
    async onSuccess() {
      totpURI.value = ''
      setupCode.value = ''
      await queryClient.invalidateQueries({ queryKey: cloudQueryKeys.mfa })
    },
    onError() {
      error.value = 'mfa_invalid_code'
    }
  })
  const addPasskey = useMutation({
    async mutationFn(name?: string) {
      const instance = discovery()
      if (!instance) throw new Error('Cloud discovery is unavailable')
      const result = await createCloudAuthClient(instance).passkey.addPasskey({ name })
      if (result.error) throw new Error(result.error.message)
    },
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cloudQueryKeys.mfa }),
        queryClient.invalidateQueries({ queryKey: cloudQueryKeys.passkeys })
      ])
    },
    onError() {
      error.value = 'passkey_failed'
    }
  })
  const deletePasskey = useMutation({
    mutationFn: (id: string) => cloudAdminAPI.deletePasskey(id),
    async onSuccess() {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cloudQueryKeys.mfa }),
        queryClient.invalidateQueries({ queryKey: cloudQueryKeys.passkeys })
      ])
    }
  })

  return {
    addPasskey,
    backupCodes,
    deletePasskey,
    enabled,
    enableTOTP,
    error,
    passkeys,
    setupCode,
    status,
    totpURI,
    verifyTOTP
  }
}
