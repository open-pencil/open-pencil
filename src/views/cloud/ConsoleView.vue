<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { CONFIRM_PAGE } from '@/app/cloud-portal/navigation'
import PortalConsoleLayout from '@/components/cloud-portal/layout/PortalConsoleLayout.vue'
import { PORTAL_SECTION_ICONS } from '@/components/cloud-portal/layout/sections'
import AccessTokensSection from '@/components/cloud-portal/sections/AccessTokensSection.vue'
import AdminActivitySection from '@/components/cloud-portal/sections/AdminActivitySection.vue'
import AdminDocumentsSection from '@/components/cloud-portal/sections/AdminDocumentsSection.vue'
import AdminEmailSection from '@/components/cloud-portal/sections/AdminEmailSection.vue'
import AdminOverviewSection from '@/components/cloud-portal/sections/AdminOverviewSection.vue'
import AdminPeopleSection from '@/components/cloud-portal/sections/AdminPeopleSection.vue'
import AdminPersonSection from '@/components/cloud-portal/sections/AdminPersonSection.vue'
import AdminReportsSection from '@/components/cloud-portal/sections/AdminReportsSection.vue'
import AdminRequestsSection from '@/components/cloud-portal/sections/AdminRequestsSection.vue'
import ConnectedAppsSection from '@/components/cloud-portal/sections/ConnectedAppsSection.vue'
import NotificationsSection from '@/components/cloud-portal/sections/NotificationsSection.vue'
import PlanSection from '@/components/cloud-portal/sections/PlanSection.vue'
import ProfileSection from '@/components/cloud-portal/sections/ProfileSection.vue'
import SecuritySection from '@/components/cloud-portal/sections/SecuritySection.vue'
import SessionsSection from '@/components/cloud-portal/sections/SessionsSection.vue'
import type { PortalSection } from '@/components/cloud-portal/types'

const ACCOUNT_SECTIONS = [
  'profile',
  'plan',
  'notifications',
  'security',
  'sessions',
  'tokens',
  'apps'
] as const
/** Every section, and a few people's pages, stay loaded while others are shown. */
const SECTIONS_KEPT = 14
const ADMIN_SECTIONS = [
  'overview',
  'requests',
  'reports',
  'documents',
  'people',
  'email',
  'activity'
] as const
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
const messages = useMessages('cloud/portal')
const planMessages = useMessages('cloud/portal/plan')
const tokenMessages = useMessages('cloud/portal/tokens')
const appMessages = useMessages('cloud/portal/apps')
const waiting = ref(0)
const openReports = ref(0)
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
    {
      id: 'profile',
      icon: PORTAL_SECTION_ICONS.profile,
      label: value.profile,
      group: value.sectionAccount
    },
    // Only a server that sells plans has one to show.
    ...(portal.discovery.billing
      ? [
          {
            id: 'plan',
            icon: PORTAL_SECTION_ICONS.plan,
            label: planMessages.value.plan,
            group: value.sectionAccount
          }
        ]
      : []),
    {
      id: 'notifications',
      icon: PORTAL_SECTION_ICONS.notifications,
      label: value.notifications,
      group: value.sectionAccount
    },
    {
      id: 'security',
      icon: PORTAL_SECTION_ICONS.security,
      label: value.security,
      group: value.sectionAccount
    },
    {
      id: 'sessions',
      icon: PORTAL_SECTION_ICONS.sessions,
      label: value.sessions,
      group: value.sectionAccount
    },
    {
      id: 'tokens',
      icon: PORTAL_SECTION_ICONS.tokens,
      label: tokenMessages.value.accessTokens,
      group: value.sectionAccount
    },
    // Only a server that accepts apps has any connected.
    ...(portal.discovery.capabilities.apps
      ? [
          {
            id: 'apps',
            icon: PORTAL_SECTION_ICONS.apps,
            label: appMessages.value.connectedApps,
            group: value.sectionAccount
          }
        ]
      : [])
  ]
  if (!admin.value) return account
  return [
    ...account,
    {
      id: 'overview',
      icon: PORTAL_SECTION_ICONS.overview,
      label: value.overview,
      group: value.sectionServer
    },
    {
      id: 'requests',
      icon: PORTAL_SECTION_ICONS.requests,
      label: value.accessRequests,
      group: value.sectionServer,
      count: waiting.value || undefined
    },
    {
      id: 'reports',
      icon: PORTAL_SECTION_ICONS.reports,
      label: value.reports,
      group: value.sectionServer,
      count: openReports.value || undefined
    },
    {
      id: 'documents',
      icon: PORTAL_SECTION_ICONS.documents,
      label: value.documents,
      group: value.sectionServer
    },
    {
      id: 'people',
      icon: PORTAL_SECTION_ICONS.people,
      label: value.people,
      group: value.sectionServer
    },
    {
      id: 'email',
      icon: PORTAL_SECTION_ICONS.email,
      label: value.emailDelivery,
      group: value.sectionServer
    },
    {
      id: 'activity',
      icon: PORTAL_SECTION_ICONS.activity,
      label: value.activity,
      group: value.sectionServer
    }
  ]
})
const heading = computed(
  () => sections.value.find((section) => section.id === active.value)?.label ?? ''
)
// Null while the page's description waits on what it counts, so the layout keeps its line.
const description = computed(() => {
  if (personId.value) return ''
  const value = messages.value
  const descriptions: Record<SectionId, string | null> = {
    profile: value.profileDescription({ host: portal.host }),
    plan: planMessages.value.planDescription,
    security: value.securityDescription({ host: portal.host }),
    notifications: value.notificationsDescription,
    sessions: value.sessionsDescription,
    tokens: tokenMessages.value.accessTokensDescription,
    apps: appMessages.value.connectedAppsDescription,
    overview: portal.host,
    requests: value.accessRequestsDescription,
    reports: value.reportsDescription,
    documents: value.documentsDescription,
    people: peopleTotal.value === null ? null : value.peopleDescription(peopleTotal.value),
    email: value.emailDeliveryDescription,
    activity: value.activityDescription
  }
  return descriptions[active.value]
})

/** The waiting-requests and open-reports badges; when they can't be read, they keep their counts. */
async function refreshWaiting() {
  if (!admin.value) return
  const operations = await portal.api.operations().catch(() => null)
  if (!operations) return
  waiting.value = operations.pendingEnrollment
  openReports.value = operations.openReports
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

// The server's pages ask an administrator's session to have proved its second step lately; one
// that has not, and has a second step, proves it first and comes back.
const adminPage = computed(() => personId.value !== null || isAdminSection(active.value))
watch(
  () => adminPage.value && route.fullPath,
  async (page, _, onCleanup) => {
    if (!page) return
    // An answer that comes after the person moved on, or left the console, decides nothing.
    let current = true
    onCleanup(() => {
      current = false
    })
    const mfa = (await portal.api.mfaStatus().catch(() => null))?.mfa
    if (current && route.fullPath === page && mfa?.required && mfa.enabled) {
      await router.replace({ path: CONFIRM_PAGE, query: { redirect: page } })
    }
  },
  { immediate: true }
)
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
    <!-- Sections keep what they loaded while another is shown, and load again on return. -->
    <KeepAlive :max="SECTIONS_KEPT">
      <ProfileSection v-if="active === 'profile'" />
      <PlanSection v-else-if="active === 'plan'" />
      <SecuritySection v-else-if="active === 'security'" />
      <NotificationsSection v-else-if="active === 'notifications'" />
      <SessionsSection v-else-if="active === 'sessions'" />
      <AccessTokensSection v-else-if="active === 'tokens'" />
      <ConnectedAppsSection v-else-if="active === 'apps'" />
      <AdminOverviewSection v-else-if="active === 'overview'" @open="select" />
      <AdminRequestsSection v-else-if="active === 'requests'" @changed="refreshWaiting" />
      <AdminReportsSection v-else-if="active === 'reports'" @changed="refreshWaiting" />
      <AdminDocumentsSection v-else-if="active === 'documents'" @changed="refreshWaiting" />
      <AdminPersonSection
        v-else-if="personId"
        :key="personId"
        :user-id="personId"
        @back="select('people')"
        @deleted="(userId) => userId === personId && select('people')"
      />
      <AdminPeopleSection
        v-else-if="active === 'people'"
        @total="(count) => (peopleTotal = count)"
        @open="openPerson"
      />
      <AdminEmailSection v-else-if="active === 'email'" />
      <AdminActivitySection v-else />
    </KeepAlive>
  </PortalConsoleLayout>
</template>
