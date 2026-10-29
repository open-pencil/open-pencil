import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import CloudConnectDialog from './CloudConnectDialog.vue'
import type {
  CloudAuthFailure,
  CloudConnectError,
  CloudConnectServer,
  CloudConnectStep,
  CloudServerKind,
  CloudSignInMethod
} from './types'

type Args = {
  step: CloudConnectStep
  kind: CloudServerKind
  choosing: boolean
  address: string
  server: CloudConnectServer | null
  error: CloudConnectError | null
  failure: CloudAuthFailure | null
  email: string
  device: { code: string; expiresIn: string } | null
  desktop: boolean
  canGoBack: boolean
  onContinue: () => void
  onSignIn: (method: CloudSignInMethod) => void
}

const EMAIL_PASSWORD = { signUp: true, minimumPasswordLength: 8 }
const TEAM: CloudConnectServer = {
  host: 'cloud.studio.example',
  methods: [],
  emailPassword: EMAIL_PASSWORD,
  approvalRequired: false
}

const meta = {
  title: 'App/Cloud/Connect Dialog',
  tags: ['autodocs'],
  args: {
    step: 'server',
    kind: 'official',
    choosing: true,
    address: '',
    server: null,
    error: null,
    failure: null,
    email: '',
    device: null,
    desktop: false,
    canGoBack: false,
    onContinue: fn(),
    onSignIn: fn()
  },
  render: (args) => ({
    components: { CloudConnectDialog },
    setup: () => ({ args, kind: ref(args.kind), address: ref(args.address) }),
    template: `
      <div class="h-[640px]">
        <CloudConnectDialog
          :open="true"
          v-model:kind="kind"
          v-model:address="address"
          official="cloud.openpencil.dev"
          :step="args.step"
          :choosing="args.choosing"
          :server="args.server"
          :error="args.error"
          :failure="args.failure"
          :email="args.email"
          :device="args.device"
          :desktop="args.desktop"
          :can-go-back="args.canGoBack"
          @continue="args.onContinue"
          @sign-in="args.onSignIn"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseServer: Story = {}

export const TeamServerAddress: Story = {
  args: { kind: 'self-hosted', choosing: false, address: 'https://cloud.studio.example' }
}

export const Checking: Story = {
  args: { kind: 'self-hosted', address: 'https://cloud.studio.example', step: 'checking' }
}

export const NotACloudServer: Story = {
  args: { kind: 'self-hosted', address: 'https://studio.example', error: 'not-cloud' }
}

export const SignIn: Story = {
  args: {
    step: 'sign-in',
    choosing: false,
    server: {
      host: 'cloud.openpencil.dev',
      methods: ['google', 'apple'],
      emailPassword: EMAIL_PASSWORD,
      approvalRequired: false
    }
  }
}

export const SignInToTeamServer: Story = {
  args: { step: 'sign-in', kind: 'self-hosted', choosing: false, canGoBack: true, server: TEAM }
}

export const WrongPassword: Story = {
  args: { ...SignInToTeamServer.args, failure: 'invalid-credentials' }
}

export const SignUp: Story = {
  args: {
    step: 'sign-up',
    kind: 'self-hosted',
    canGoBack: true,
    server: { ...TEAM, approvalRequired: true }
  }
}

export const CheckEmail: Story = {
  args: {
    step: 'verify',
    kind: 'self-hosted',
    canGoBack: true,
    server: TEAM,
    email: 'ada@studio.example'
  }
}

export const NotConfirmedYet: Story = {
  args: { ...CheckEmail.args, failure: 'email-not-verified' }
}

/** Editors on another address than the server's own can only approve a code in the browser. */
export const SignInElsewhere: Story = {
  args: {
    step: 'sign-in',
    choosing: false,
    desktop: true,
    server: { ...TEAM, methods: ['google', 'email'], emailPassword: null }
  }
}

export const ConfirmCodeOnDesktop: Story = {
  args: {
    step: 'device',
    desktop: true,
    server: { ...TEAM, methods: ['google'] },
    device: { code: 'WDJB-MJHT', expiresIn: '9:41' }
  }
}
