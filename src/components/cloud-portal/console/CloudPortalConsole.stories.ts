import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { ref } from 'vue'

import PortalAccountSecurity from '../account/PortalAccountSecurity.vue'
import PortalConsoleLayout from '../layout/PortalConsoleLayout.vue'
import type { AccessRequest, PortalSection } from '../types'
import PortalAccessRequests from './PortalAccessRequests.vue'
import PortalActivity from './PortalActivity.vue'
import PortalEmailDelivery from './PortalEmailDelivery.vue'
import PortalPeople from './PortalPeople.vue'
import PortalStatus from './PortalStatus.vue'

const account = { id: 'user-ana', name: 'Ana Duarte', email: 'ana@studio.example' }
const sections: PortalSection[] = [
  { id: 'security', label: 'Sign-in and security', group: 'Your account' },
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
const components = {
  PortalConsoleLayout,
  PortalAccountSecurity,
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
    setup: () => ({ account, sections, requests, filter: ref('pending'), ...extra }),
    template: `
      <div class="h-[720px]">
        <PortalConsoleLayout host="cloud.studio.example" :account="account" :sections="sections" active="${active}" heading="${heading}" description="${description}">
          ${body}
        </PortalConsoleLayout>
      </div>`
  })
})

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
  `<PortalStatus :status="{ deployment: 'self-hosted', enrollmentMode: 'approval', emailTransport: 'smtp', pendingEnrollment: 3, pendingEmail: 0, failedEmail: 1 }" />`
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
  `<PortalPeople :people="[
    { id: 'user-ana', name: 'Ana Duarte', email: 'ana@studio.example', admin: true, suspended: false, joinedOn: 'in March', you: true },
    { id: 'user-ben', name: 'Ben Ortiz', email: 'ben@studio.example', admin: true, suspended: false, joinedOn: 'in March' },
    { id: 'user-mia', name: 'Mia Chen', email: 'mia@client.example', admin: false, suspended: false, joinedOn: 'in June' },
    { id: 'user-tom', name: 'Tom Weber', email: 'tom@agency.example', admin: false, suspended: true, joinedOn: 'last week' }
  ]" />`
)
export const EmailDelivery = story(
  'email',
  'Email delivery',
  'Invitations, sign-in links, and access decisions the server sends.',
  `<PortalEmailDelivery :emails="[
    { id: 'e1', kind: 'document-invitation', recipient: 'chloe@agency.example', status: 'failed', attempts: 5, when: '10:42', error: 'Mailbox unavailable' },
    { id: 'e2', kind: 'email-verification', recipient: 'diego@studio.example', status: 'sent', attempts: 1, when: '09:15' },
    { id: 'e3', kind: 'enrollment-approved', recipient: 'mia@client.example', status: 'sent', attempts: 1, when: 'Yesterday' }
  ]" />`
)
export const Activity = story(
  'activity',
  'Activity',
  'What administrators did on this server.',
  `<PortalActivity :entries="[
    { id: 'a1', actor: { id: 'user-ana', name: 'Ana Duarte' }, action: 'enrollment.approved', target: 'mia@client.example', when: 'Yesterday' },
    { id: 'a2', actor: { id: 'user-ben', name: 'Ben Ortiz' }, action: 'user.banned', target: 'tom@agency.example', when: 'Mon' },
    { id: 'a3', actor: { id: 'user-ana', name: 'Ana Duarte' }, action: 'user.admin-granted', target: 'Ben Ortiz', when: 'Sep 28' }
  ]" />`
)
