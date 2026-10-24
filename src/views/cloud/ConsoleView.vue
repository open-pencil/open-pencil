<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import PortalConsoleLayout from '@/components/cloud-portal/layout/PortalConsoleLayout.vue'
import AdminActivitySection from '@/components/cloud-portal/sections/AdminActivitySection.vue'
import AdminEmailSection from '@/components/cloud-portal/sections/AdminEmailSection.vue'
import AdminOverviewSection from '@/components/cloud-portal/sections/AdminOverviewSection.vue'
import AdminPeopleSection from '@/components/cloud-portal/sections/AdminPeopleSection.vue'
import AdminPersonSection from '@/components/cloud-portal/sections/AdminPersonSection.vue'
import AdminRequestsSection from '@/components/cloud-portal/sections/AdminRequestsSection.vue'
import ProfileSection from '@/components/cloud-portal/sections/ProfileSection.vue'
import SecuritySection from '@/components/cloud-portal/sections/SecuritySection.vue'
import SessionsSection from '@/components/cloud-portal/sections/SessionsSection.vue'
import type { PortalSection } from '@/components/cloud-portal/types'

const ACCOUNT_SECTIONS = ['profile', 'security', 'sessions'] as const
const ADMIN_SECTIONS = ['overview', 'requests', 'people', 'email', 'activity'] as const
type AccountSectionId = (typeof ACCOUNT_SECTIONS)[number]
type AdminSectionId = (typeof ADMIN_SECTIONS)[number]
type SectionId = AccountSectionId | AdminSectionId

function isAccountSection(value: unknown): value is AccountSectionId {
  return ACCOUNT_SECTIONS.some((section) => section === value)
}

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
/** The account an administrator opened from People, when the page shows one. */
const personId = computed(() => {
  const value = route.params.userId
  return route.name === 'person' && typeof value === 'string' ? value : null
})
const active = computed<SectionId>(() => {
  if (isAccountSection(route.name)) return route.name
  if (personId.value) return 'people'
  const section = route.params.section
  return isAdminSection(section) ? section : 'overview'
})
const sections = computed<PortalSection[]>(() => {
  const value = messages.value
  const account: PortalSection[] = [
    { id: 'profile', label: value.profile, group: value.sectionAccount },
    { id: 'security', label: value.security, group: value.sectionAccount },
    { id: 'sessions', label: value.sessions, group: value.sectionAccount }
  ]
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
  if (personId.value) return ''
  const value = messages.value
  const descriptions: Record<SectionId, string> = {
    profile: value.profileDescription({ host: portal.host }),
    security: value.securityDescription({ host: portal.host }),
    sessions: value.sessionsDescription,
    overview: portal.host,
    requests: value.accessRequestsDescription,
    people: peopleTotal.value === null ? '' : value.peopleDescription(peopleTotal.value),
    email: value.emailDeliveryDescription,
    activity: value.activityDescription
  }
  return descriptions[active.value]
})

/** The waiting-requests badge; when it can't be read, it keeps its last count. */
async function refreshWaiting() {
  if (!admin.value) return
  const operations = await portal.api.operations().catch(() => null)
  if (operations) waiting.value = operations.pendingEnrollment
}

function select(id: string) {
  if (isAccountSection(id)) void router.push({ name: id })
  else void router.push({ name: 'admin', params: { section: id === 'overview' ? '' : id } })
}

function openPerson(userId: string) {
  void router.push({ name: 'person', params: { userId } })
}

async function signOut() {
  await portal.auth.signOut()
  await portal.refreshAccount()
  await router.replace({ name: 'welcome' })
}

onMounted(() => void refreshWaiting())
</script>

<template>
  <PortalConsoleLayout
    v-if="portal.account.value"
    :host="portal.host"
    :account="{
      id: portal.account.value.user.userId,
      name: portal.account.value.user.name,
      email: portal.account.value.user.email,
      image: portal.account.value.user.image ?? null
    }"
    :sections="sections"
    :active="active"
    :heading="heading"
    :description="description"
    @select="select"
    @sign-out="signOut"
  >
    <ProfileSection v-if="active === 'profile'" />
    <SecuritySection v-else-if="active === 'security'" />
    <SessionsSection v-else-if="active === 'sessions'" />
    <AdminOverviewSection v-else-if="active === 'overview'" @open="select" />
    <AdminRequestsSection v-else-if="active === 'requests'" @changed="refreshWaiting" />
    <AdminPersonSection v-else-if="personId" :user-id="personId" @back="select('people')" />
    <AdminPeopleSection
      v-else-if="active === 'people'"
      @total="(count) => (peopleTotal = count)"
      @open="openPerson"
    />
    <AdminEmailSection v-else-if="active === 'email'" />
    <AdminActivitySection v-else />
  </PortalConsoleLayout>
</template>
