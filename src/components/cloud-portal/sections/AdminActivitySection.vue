<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue'

import { useCloudPortalMessages, useI18n } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalFailureMessages } from '@/app/cloud-portal/failure'
import { portalDate } from '@/app/cloud-portal/format'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalActivity from '../console/PortalActivity.vue'
import type { PortalActivityEntry } from '../types'

const portal = usePortal()
const messages = useCloudPortalMessages()
const { locale } = useI18n()
const failures = usePortalFailureMessages()
const entries = shallowRef<PortalActivityEntry[]>([])
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    // Events name accounts by ID; the people list gives them names.
    const [{ events }, { users }, { enrollments }] = await Promise.all([
      portal.api.audit(),
      portal.api.users(),
      portal.api.enrollments()
    ])
    const names = new Map(users.map((user) => [user.id, user.name]))
    const requesters = new Map(enrollments.map((enrollment) => [enrollment.id, enrollment.email]))
    entries.value = events.map((event) => ({
      id: event.id,
      actor: {
        id: event.actorUserId,
        name: names.get(event.actorUserId) ?? messages.value.someoneElse
      },
      action: event.action,
      target: names.get(event.subjectId) ?? requesters.get(event.subjectId) ?? event.subjectId,
      when: portalDate(event.createdAt, locale.value)
    }))
  } catch (cause) {
    error.value = failures.api(cause)
  }
})
</script>

<template>
  <AppAlert v-if="error" tone="error" :heading="messages.errorTitle" :description="error" />
  <PortalActivity v-else :entries="entries" />
</template>
