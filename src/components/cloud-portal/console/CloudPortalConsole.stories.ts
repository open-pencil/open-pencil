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
    requestedAgo: '2 hours ago',
    status: 'pending'
  },
  {
    id: '2',
    name: 'Diego Ruiz',
    email: 'diego@studio.example',
    reason: '',
    requestedAgo: 'yesterday',
    status: 'pending'
  },
  {
    id: '3',
    name: 'Priya Nair',
    email: 'priya@client.example',
    reason: 'Reviewing the new brand system with the studio.',
    requestedAgo: '3 days ago',
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
    :methods="[{ provider: 'google', linked: true, email: 'ana@studio.example' }, { provider: 'apple', linked: false }]"
    :password="{ set: true, changedAgo: '3 months ago' }"
    :authenticator="{ on: true, recoveryCodesLeft: 8 }"
    :passkeys="[{ id: 'p1', name: 'MacBook Pro', addedAgo: 'in July', lastUsedAgo: 'today' }]"
  />`
)
export const AdministratorWithoutTwoStep = story(
  'security',
  'Sign-in and security',
  'How you sign in to cloud.studio.example.',
  `<PortalAccountSecurity
    admin-requires-two-factor
    :methods="[{ provider: 'google', linked: true, email: 'ana@studio.example' }]"
    :password="{ set: false }"
    :authenticator="{ on: false }"
    :passkeys="[]"
  />`
)
export const Overview = story(
  'status',
  'Overview',
  'cloud.studio.example',
  `<PortalStatus :status="{ version: '0.15.1', enrollment: 'Reviewed by an administrator', email: 'SMTP · mail.studio.example', waitingRequests: 3, waitingEmails: 0, failedEmails: 1 }" />`
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
    { id: 'user-ana', name: 'Ana Duarte', email: 'ana@studio.example', admin: true, suspended: false, twoStep: true, joinedAgo: 'in March', you: true },
    { id: 'user-ben', name: 'Ben Ortiz', email: 'ben@studio.example', admin: true, suspended: false, twoStep: false, joinedAgo: 'in March' },
    { id: 'user-mia', name: 'Mia Chen', email: 'mia@client.example', admin: false, suspended: false, twoStep: true, joinedAgo: 'in June' },
    { id: 'user-tom', name: 'Tom Weber', email: 'tom@agency.example', admin: false, suspended: true, twoStep: false, joinedAgo: 'last week' }
  ]" />`
)
export const EmailDelivery = story(
  'email',
  'Email delivery',
  'Invitations, sign-in links, and access decisions the server sends.',
  `<PortalEmailDelivery :emails="[
    { id: 'e1', subject: 'Ana invited you to edit Homepage redesign', recipient: 'chloe@agency.example', status: 'failed', attempts: 5, when: '10:42', error: 'Mailbox unavailable' },
    { id: 'e2', subject: 'Verify your email', recipient: 'diego@studio.example', status: 'sent', attempts: 1, when: '09:15' },
    { id: 'e3', subject: 'Your access was approved', recipient: 'mia@client.example', status: 'sent', attempts: 1, when: 'Yesterday' }
  ]" />`
)
export const Activity = story(
  'activity',
  'Activity',
  'What administrators did on this server.',
  `<PortalActivity :entries="[
    { id: 'a1', actor: { id: 'user-ana', name: 'Ana Duarte' }, action: 'approved access for', target: 'mia@client.example', when: 'Yesterday' },
    { id: 'a2', actor: { id: 'user-ben', name: 'Ben Ortiz' }, action: 'suspended', target: 'tom@agency.example', when: 'Mon' },
    { id: 'a3', actor: { id: 'user-ana', name: 'Ana Duarte' }, action: 'made an administrator:', target: 'Ben Ortiz', when: 'Sep 28' }
  ]" />`
)
