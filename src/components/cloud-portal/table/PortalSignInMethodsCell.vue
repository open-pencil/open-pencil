<script setup lang="ts">
import { isKnownSocialProvider } from '@open-pencil/cloud/contract'

import { usePortalSignInMethodLabel } from '@/app/cloud-portal/methods'
import CloudProviderLogo from '@/components/cloud/account/CloudProviderLogo.vue'
import Tip from '@/components/ui/overlay/Tip.vue'

/** The ways an account signs in, as their marks: a key for a password, a provider's logo. */
const { methods } = defineProps<{ methods: readonly string[] }>()
const label = usePortalSignInMethodLabel()
</script>

<template>
  <span class="flex items-center gap-1.5 text-muted">
    <Tip v-for="method in methods" :key="method" :label="label(method)">
      <span role="img" :aria-label="label(method)" class="flex size-4 items-center justify-center">
        <CloudProviderLogo
          v-if="isKnownSocialProvider(method)"
          :provider="method"
          class="size-3.5"
        />
        <icon-lucide-key-round v-else class="size-3.5" />
      </span>
    </Tip>
  </span>
</template>
