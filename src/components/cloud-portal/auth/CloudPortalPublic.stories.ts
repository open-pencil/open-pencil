import type { Meta, StoryObj } from '@storybook/vue3-vite'
import IconCheck from '~icons/lucide/check'
import IconClock from '~icons/lucide/clock'
import IconMailCheck from '~icons/lucide/mail-check'
import IconMonitorX from '~icons/lucide/monitor-x'

import AppButton from '@/components/ui/button/AppButton.vue'

import PortalDeviceApproval from './PortalDeviceApproval.vue'
import PortalNotice from './PortalNotice.vue'
import PortalResetPassword from './PortalResetPassword.vue'
import PortalSignIn from './PortalSignIn.vue'
import PortalTwoFactor from './PortalTwoFactor.vue'

const host = 'cloud.studio.example'
const frame = (inner: string) => `<div class="h-[720px]">${inner}</div>`
const components = {
  PortalDeviceApproval,
  PortalNotice,
  PortalResetPassword,
  PortalSignIn,
  PortalTwoFactor,
  AppButton,
  IconCheck,
  IconClock,
  IconMailCheck,
  IconMonitorX
}

const meta = {
  title: 'App/Cloud Portal/Public Pages',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const story = (template: string): Story => ({
  render: () => ({ components, setup: () => ({ host }), template: frame(template) })
})

export const SignIn = story(
  `<PortalSignIn :host="host" mode="sign-in" :providers="['google', 'apple']" :email-password="{ signUp: true, minimumPasswordLength: 15 }" />`
)
export const SignInForTheDesktopApp = story(
  `<PortalSignIn :host="host" mode="sign-in" :providers="['google']" :email-password="{ signUp: true, minimumPasswordLength: 15 }" returns-to="the OpenPencil app" />`
)
export const SignInWithAnError = story(
  `<PortalSignIn :host="host" mode="sign-in" :providers="[]" :email-password="{ signUp: false, minimumPasswordLength: 15 }" error="The email or password is wrong." />`
)
export const SignUpWithApproval = story(
  `<PortalSignIn :host="host" mode="sign-up" :providers="['google']" :email-password="{ signUp: true, minimumPasswordLength: 15 }" approval-required />`
)
export const CheckYourEmail = story(`
  <PortalNotice :host="host" heading="Check your email" description="We sent a link to ana@studio.example. Open it on this device to finish creating your account.">
    <template #icon><IconMailCheck class="size-5" /></template>
    <template #actions>
      <AppButton variant="outline">Send again</AppButton>
      <AppButton variant="ghost">Use another email</AppButton>
    </template>
  </PortalNotice>`)
export const WaitingForApproval = story(`
  <PortalNotice :host="host" tone="waiting" heading="Your request is with an administrator" description="We email ana@studio.example when you can sign in. Nothing else to do for now.">
    <template #icon><IconClock class="size-5" /></template>
    <template #actions><AppButton variant="ghost">Sign out</AppButton></template>
  </PortalNotice>`)
export const TwoStep = story(`<PortalTwoFactor :host="host" method="authenticator" passkeys />`)
export const TwoStepRecoveryCode = story(
  `<PortalTwoFactor :host="host" method="recovery" error="This code was already used." />`
)
export const ForgotPassword = story(`<PortalResetPassword :host="host" step="request" />`)
export const ChooseNewPassword = story(`<PortalResetPassword :host="host" step="choose" />`)
export const ApproveDesktopSignIn = story(
  `<PortalDeviceApproval :host="host" code="WDJB-MJHT" device="OpenPencil for macOS" :account="{ name: 'Ana Duarte', email: 'ana@studio.example' }" />`
)
export const DesktopSignInApproved = story(`
  <PortalNotice :host="host" tone="success" heading="You’re signed in" description="Go back to the OpenPencil app; it has already picked this up. You can close this tab.">
    <template #icon><IconCheck class="size-5" /></template>
  </PortalNotice>`)
export const DesktopSignInDenied = story(`
  <PortalNotice :host="host" heading="Sign-in denied" description="The app wasn’t signed in. If you didn’t start this, someone may know your password; change it in your account settings.">
    <template #icon><IconMonitorX class="size-5" /></template>
    <template #actions><AppButton variant="outline">Account settings</AppButton></template>
  </PortalNotice>`)
