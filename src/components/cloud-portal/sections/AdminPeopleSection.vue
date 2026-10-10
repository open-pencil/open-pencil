<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { ref, shallowRef, watch } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalDate } from '@/app/cloud-portal/format'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPeople from '../console/PortalPeople.vue'
import type { PortalPerson } from '../types'

const emit = defineEmits<{ total: [count: number] }>()
const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const failures = usePortalFailureMessages()
const query = ref('')
const search = refDebounced(query, 250)
const people = shallowRef<PortalPerson[]>([])
const error = ref<string | null>(null)

async function load() {
  try {
    const { users, total } = await portal.api.users(search.value.trim() || undefined)
    const you = portal.account.value?.user.userId
    people.value = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      admin: user.role === 'admin',
      suspended: user.banned === true,
      joinedOn: portalDate(user.createdAt, locale.value),
      you: user.id === you
    }))
    emit('total', total)
  } catch (cause) {
    error.value = failures.api(cause)
  }
}

async function act(change: () => Promise<unknown>) {
  error.value = null
  try {
    await change()
    await load()
  } catch (cause) {
    error.value = failures.api(cause)
  }
}

watch(search, () => void load(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-3">
    <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
    <PortalPeople
      v-model:query="query"
      :people="people"
      @toggle-admin="(person) => act(() => portal.api.setAdmin(person.id, !person.admin))"
      @sign-out-everywhere="
        (person) => act(() => portal.api.userAction('revoke-sessions', person.id))
      "
      @toggle-suspended="
        (person) => act(() => portal.api.userAction(person.suspended ? 'unban' : 'ban', person.id))
      "
    />
  </div>
</template>
