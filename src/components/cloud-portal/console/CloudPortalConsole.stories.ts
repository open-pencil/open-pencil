import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import PortalAccountSecurity from '../account/PortalAccountSecurity.vue'
import PortalProfile from '../account/PortalProfile.vue'
import PortalSessions from '../account/PortalSessions.vue'
import PortalConsoleLayout from '../layout/PortalConsoleLayout.vue'
import type {
  AccessRequest,
  PortalPerson,
  PortalPersonDetail,
  PortalSection,
  PortalSession,
  PortalSignIn
} from '../types'
import PortalAccessRequests from './PortalAccessRequests.vue'
import PortalActivity from './PortalActivity.vue'
import PortalEmailDelivery from './PortalEmailDelivery.vue'
import PortalPeople from './PortalPeople.vue'
import PortalPersonPage from './PortalPerson.vue'
import PortalStatus from './PortalStatus.vue'

const account = { id: 'user-ana', name: 'Ana Duarte', email: 'ana@studio.example' }
const sections: PortalSection[] = [
  { id: 'profile', label: 'Profile', group: 'Your account' },
  { id: 'security', label: 'Sign-in and security', group: 'Your account' },
  { id: 'sessions', label: 'Sessions', group: 'Your account' },
  { id: 'status', label: 'Overview', group: 'Server' },
  { id: 'requests', label: 'Access requests', group: 'Server', count: 3 },
  { id: 'people', label: 'People', group: 'Server' },
  { id: 'email', label: 'Email delivery', group: 'Server' },
  { id: 'activity', label: 'Activity', group: 'Server' }
]
const requests: AccessRequest[] = [
  {
    id: '1',
    name: 'Chloe Martin',
    email: 'chloe@agency.example',
    reason: 'Freelance illustrator on the spring campaign; Ben asked me to join.',
    requestedOn: '2 hours ago',
    status: 'pending'
  },
  {
    id: '2',
    name: 'Diego Ruiz',
    email: 'diego@studio.example',
    reason: '',
    requestedOn: 'yesterday',
    status: 'pending'
  },
  {
    id: '3',
    name: 'Priya Nair',
    email: 'priya@client.example',
    reason: 'Reviewing the new brand system with the studio.',
    requestedOn: '3 days ago',
    status: 'pending'
  }
]
const people: PortalPerson[] = [
  {
    id: 'user-ana',
    name: 'Ana Duarte',
    email: 'ana@studio.example',
    admin: true,
    suspended: false,
    twoStep: true,
    joinedOn: 'Mar 3, 2026',
    lastActive: 'now',
    workspaceCount: 3,
    you: true
  },
  {
    id: 'user-ben',
    name: 'Ben Ortiz',
    email: 'ben@studio.example',
    admin: true,
    suspended: false,
    twoStep: true,
    joinedOn: 'Mar 3, 2026',
    lastActive: '2 hr. ago',
    workspaceCount: 2
  },
  {
    id: 'user-mia',
    name: 'Mia Chen',
    email: 'mia@client.example',
    admin: false,
    suspended: false,
    twoStep: false,
    joinedOn: 'Jun 12, 2026',
    lastActive: 'yesterday',
    workspaceCount: 1
  },
  {
    id: 'user-tom',
    name: 'Tom Weber',
    email: 'tom@agency.example',
    admin: false,
    suspended: true,
    suspendedReason: 'Shared files outside the studio',
    twoStep: false,
    joinedOn: 'Oct 2, 2026',
    lastActive: null,
    workspaceCount: 0
  }
]
const counts = { all: 24, administrators: 2, suspended: 1, 'without-two-step': 9 }
const sessions: PortalSession[] = [
  {
    id: 's1',
    current: true,
    method: 'passkey',
    browser: 'Chrome 141',
    system: 'macOS',
    ipAddress: '203.0.113.9',
    lastActive: 'now',
    signedInOn: 'Oct 20, 2026'
  },
  {
    id: 's2',
    current: false,
    method: 'desktop',
    browser: null,
    system: 'macOS',
    ipAddress: '203.0.113.9',
    lastActive: '3 hr. ago',
    signedInOn: 'Oct 2, 2026'
  },
  {
    id: 's3',
    current: false,
    method: 'google',
    browser: 'Safari 26',
    system: 'iOS',
    ipAddress: '198.51.100.24',
    lastActive: '4 days',
    signedInOn: 'Sep 28, 2026'
  }
]
const signIns: PortalSignIn[] = [
  {
    id: 'i1',
    method: 'passkey',
    browser: 'Chrome 141',
    system: 'macOS',
    ipAddress: '203.0.113.9',
    when: 'Oct 20, 2026, 9:14 AM'
  },
  {
    id: 'i2',
    method: 'desktop',
    browser: null,
    system: 'macOS',
    ipAddress: '203.0.113.9',
    when: 'Oct 2, 2026, 4:05 PM'
  },
  {
    id: 'i3',
    method: 'google',
    browser: 'Safari 26',
    system: 'iOS',
    ipAddress: '198.51.100.24',
    when: 'Sep 28, 2026, 8:40 PM'
  }
]
const person: PortalPersonDetail = {
  person: people[2] ?? people[0],
  emailVerified: true,
  methods: [
    { provider: 'credential', linkedOn: 'Jun 12, 2026' },
    { provider: 'google', linkedOn: 'Jul 1, 2026' }
  ],
  authenticator: false,
  passkeyCount: 0,
  workspaces: [
    { id: 'w1', name: 'Spring campaign', role: 'editor', memberCount: 6 },
    { id: 'w2', name: 'Mia’s workspace', role: 'admin', memberCount: 1 }
  ],
  sessions: sessions.slice(2),
  signIns: signIns.slice(2)
}
const components = {
  PortalConsoleLayout,
  PortalAccountSecurity,
  PortalProfile,
  PortalSessions,
  PortalPerson: PortalPersonPage,
  PortalAccessRequests,
  PortalActivity,
  PortalEmailDelivery,
  PortalPeople,
  PortalStatus
}

const meta = {
  title: 'App/Cloud Portal/Console',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const story = (
  active: string,
  heading: string,
  description: string,
  body: string,
  extra = {}
): Story => ({
  render: () => ({
    components,
    setup: () => ({
      account,
      sections,
      requests,
      people,
      counts,
      sessions,
      signIns,
      person,
      filter: ref('pending'),
      peopleFilter: ref('all'),
      ...extra
    }),
    template: `
      <div class="h-[720px]">
        <PortalConsoleLayout host="cloud.studio.example" :account="account" :sections="sections" active="${active}" heading="${heading}" description="${description}">
          ${body}
        </PortalConsoleLayout>
      </div>`
  })
})

export const Profile = story(
  'profile',
  'Profile',
  'How you appear to people on cloud.studio.example.',
  `<PortalProfile :profile="{ id: 'user-ana', name: 'Ana Duarte', email: 'ana@studio.example', image: null, memberSince: 'Mar 3, 2026' }" />`
)
export const Sessions = story(
  'sessions',
  'Sessions',
  'Where your account is signed in, and when it was.',
  `<PortalSessions manage :sessions="sessions" :sign-ins="signIns" />`
)
export const SignInAndSecurity = story(
  'security',
  'Sign-in and security',
  'How you sign in to cloud.studio.example.',
  `<PortalAccountSecurity
    :methods="[{ id: 'm1', provider: 'google', linkedOn: 'in March', canUnlink: true }, { id: 'm2', provider: 'credential', linkedOn: 'in March', canUnlink: true }]"
    :linkable="['apple']"
    :authenticator="{ available: true, on: true }"
    :passkeys="[{ id: 'p1', name: 'MacBook Pro', addedOn: 'in July' }]"
  />`
)
export const AdministratorWithoutTwoStep = story(
  'security',
  'Sign-in and security',
  'How you sign in to cloud.studio.example.',
  `<PortalAccountSecurity
    two-step-required
    :methods="[{ id: 'm1', provider: 'google', linkedOn: 'in March', canUnlink: false }]"
    :linkable="[]"
    :authenticator="{ available: true, on: false }"
    :passkeys="[]"
  />`
)
export const Overview = story(
  'status',
  'Overview',
  'cloud.studio.example',
  `<PortalStatus :status="{ deployment: 'self-hosted', enrollmentMode: 'approval', emailTransport: 'smtp', pendingEnrollment: 3, pendingEmail: 0, failedEmail: 1, accounts: 24, workspaces: 11, documents: 186, storedBytes: 4831838208 }" />`
)
export const AccessRequests = story(
  'requests',
  'Access requests',
  'People asking to join. Approving lets them sign in; each gets an email either way.',
  `<PortalAccessRequests v-model:filter="filter" :requests="requests" />`
)
export const NoAccessRequests = story(
  'requests',
  'Access requests',
  'People asking to join. Approving lets them sign in; each gets an email either way.',
  `<PortalAccessRequests v-model:filter="filter" :requests="[]" />`
)
export const People = story(
  'people',
  'People',
  '24 accounts on this server.',
  `<PortalPeople v-model:filter="peopleFilter" :people="people" :counts="counts" :page-size="4" />`
)
export const Person = story('people', 'People', '', `<PortalPerson :detail="person" />`)
export const EmailDelivery = story(
  'email',
  'Email delivery',
  'Invitations, sign-in links, and access decisions the server sends.',
  `<PortalEmailDelivery :emails="[
    { id: 'e1', kind: 'document-invitation', recipient: 'chloe@agency.example', status: 'failed', attempts: 5, when: '10:42', error: 'Mailbox unavailable' },
    { id: 'e2', kind: 'email-verification', recipient: 'diego@studio.example', status: 'sent', attempts: 1, when: '09:15' },
    { id: 'e4', kind: 'new-sign-in', recipient: 'ana@studio.example', status: 'sent', attempts: 1, when: '08:51' },
    { id: 'e3', kind: 'enrollment-approved', recipient: 'mia@client.example', status: 'sent', attempts: 1, when: 'Yesterday' }
  ]" />`
)
export const Activity = story(
  'activity',
  'Activity',
  'What administrators did on this server.',
  `<PortalActivity :entries="[
    { id: 'a1', actor: { id: 'user-ana', name: 'Ana Duarte' }, action: 'enrollment.approved', target: 'mia@client.example', when: 'Yesterday' },
    { id: 'a2', actor: { id: 'user-ben', name: 'Ben Ortiz' }, action: 'user.banned', target: 'Tom Weber', reason: 'Shared files outside the studio', when: 'Oct 21, 2026, 11:02 AM' },
    { id: 'a3', actor: { id: 'user-ana', name: 'Ana Duarte' }, action: 'user.admin-granted', target: 'Ben Ortiz', when: 'Sep 28' }
  ]" />`
)
