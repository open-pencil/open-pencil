<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue'

import { usePortal } from '@/app/cloud-portal/context'
import PortalConsoleLayout from '@/components/cloud-portal/layout/PortalConsoleLayout.vue'
import AdminActivitySection from '@/components/cloud-portal/sections/AdminActivitySection.vue'
import AdminEmailSection from '@/components/cloud-portal/sections/AdminEmailSection.vue'
import AdminOverviewSection from '@/components/cloud-portal/sections/AdminOverviewSection.vue'
import AdminPeopleSection from '@/components/cloud-portal/sections/AdminPeopleSection.vue'
import AdminRequestsSection from '@/components/cloud-portal/sections/AdminRequestsSection.vue'
import SecuritySection from '@/components/cloud-portal/sections/SecuritySection.vue'
import type { PortalSection } from '@/components/cloud-portal/types'

const ADMIN_SECTIONS = ['overview', 'requests', 'people', 'email', 'activity'] as const
type AdminSectionId = (typeof ADMIN_SECTIONS)[number]
type SectionId = 'security' | AdminSectionId

function isAdminSection(value: unknown): value is AdminSectionId {
  return ADMIN_SECTIONS.some((section) => section === value)
}

const portal = usePortal()
const route = useRoute()
const router = useRouter()
const messages = useCloudPortalMessages()
const waiting = ref(0)
const peopleTotal = ref<number | null>(null)

const admin = computed(() => portal.account.value?.user.deploymentRole === 'admin')
const active = computed<SectionId>(() => {
  if (route.name !== 'admin') return 'security'
  const section = route.params.section
  return isAdminSection(section) ? section : 'overview'
})
const sections = computed<PortalSection[]>(() => {
  const value = messages.value
  const account = [{ id: 'security', label: value.security, group: value.sectionAccount }]
  if (!admin.value) return account
  return [
    ...account,
    { id: 'overview', label: value.overview, group: value.sectionServer },
    {
      id: 'requests',
      label: value.accessRequests,
      group: value.sectionServer,
      count: waiting.value || undefined
    },
    { id: 'people', label: value.people, group: value.sectionServer },
    { id: 'email', label: value.emailDelivery, group: value.sectionServer },
    { id: 'activity', label: value.activity, group: value.sectionServer }
  ]
})
const heading = computed(
  () => sections.value.find((section) => section.id === active.value)?.label ?? ''
)
const description = computed(() => {
  const value = messages.value
  const descriptions: Record<SectionId, string> = {
    security: value.securityDescription({ host: portal.host }),
    overview: portal.host,
    requests: value.accessRequestsDescription,
    people: peopleTotal.value === null ? '' : value.peopleDescription(peopleTotal.value),
    email: value.emailDeliveryDescription,
    activity: value.activityDescription
  }
  return descriptions[active.value]
})

async function refreshWaiting() {
  if (!admin.value) return
  waiting.value = (await portal.api.operations()).pendingEnrollment
}

function select(id: string) {
  if (id === 'security') void router.push({ name: 'security' })
  else void router.push({ name: 'admin', params: { section: id === 'overview' ? '' : id } })
}

async function signOut() {
  await portal.auth.signOut()
  await portal.refreshAccount()
  await router.replace({ name: 'sign-in' })
}

onMounted(() => void refreshWaiting().catch(() => undefined))
</script>

<template>
  <PortalConsoleLayout
    v-if="portal.account.value"
    :host="portal.host"
    :account="{
      id: portal.account.value.user.userId,
      name: portal.account.value.user.name,
      email: portal.account.value.user.email
    }"
    :sections="sections"
    :active="active"
    :heading="heading"
    :description="description"
    @select="select"
    @sign-out="signOut"
  >
    <SecuritySection v-if="active === 'security'" />
    <AdminOverviewSection v-else-if="active === 'overview'" @open="select" />
    <AdminRequestsSection v-else-if="active === 'requests'" @changed="refreshWaiting" />
    <AdminPeopleSection v-else-if="active === 'people'" @total="(count) => (peopleTotal = count)" />
    <AdminEmailSection v-else-if="active === 'email'" />
    <AdminActivitySection v-else />
  </PortalConsoleLayout>
</template>
