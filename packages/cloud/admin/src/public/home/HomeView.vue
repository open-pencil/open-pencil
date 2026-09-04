<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { computed, watchEffect } from 'vue'
import { useRouter } from 'vue-router'

import { accountQueryOptions, discoveryQueryOptions } from '#admin/app/query/options'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import RouterActionLink from '#admin/components/navigation/RouterActionLink.vue'
import { useCloudI18n } from '#admin/i18n/use'

const messages = useCloudI18n()
const router = useRouter()
const account = useQuery(accountQueryOptions())
const discovery = useQuery(discoveryQueryOptions())
const features = [
  ['localFirstTitle', 'localFirstDescription'],
  ['portableTitle', 'portableDescription'],
  ['sharingTitle', 'sharingDescription']
] as const
const signUpAvailable = computed(
  () => discovery.data.value?.authentication.enrollmentMode !== 'closed'
)
watchEffect(() => {
  const state = account.data.value?.state
  if (state === 'active') void router.replace({ name: 'dashboard' })
  else if (state) void router.replace({ name: `account-${state}` })
})
</script>

<template>
  <PublicShell>
    <main class="mx-auto flex w-full max-w-6xl flex-col justify-center px-5 py-16">
      <section class="max-w-3xl">
        <p class="mb-3 text-xs font-medium text-component">
          {{ messages.public.value.localFirstLabel }}
        </p>
        <h1 class="m-0 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {{ messages.public.value.homeTitle }}
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-muted text-pretty">
          {{ messages.public.value.homeDescription }}
        </p>
        <div class="mt-7 flex flex-wrap gap-2">
          <RouterActionLink
            v-if="signUpAvailable"
            to="/auth/sign-up"
            color="primary"
            variant="solid"
            size="lg"
          >
            {{ messages.auth.value.signUp }}
          </RouterActionLink>
          <RouterActionLink to="/auth/sign-in" color="neutral" variant="outline" size="lg">
            {{ messages.auth.value.signIn }}
          </RouterActionLink>
        </div>
      </section>
      <section
        class="mt-16 grid gap-3 sm:grid-cols-3"
        :aria-label="messages.common.value.cloudCapabilities"
      >
        <article
          v-for="[title, description] in features"
          :key="title"
          class="rounded-lg border border-border bg-panel p-5"
        >
          <h2 class="m-0 text-sm font-semibold">{{ messages.public.value[title] }}</h2>
          <p class="mb-0 mt-2 text-xs leading-5 text-muted">
            {{ messages.public.value[description] }}
          </p>
        </article>
      </section>
    </main>
  </PublicShell>
</template>
