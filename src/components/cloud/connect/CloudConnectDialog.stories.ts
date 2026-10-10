import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { fn } from 'storybook/test'
import { ref } from 'vue'

import CloudConnectDialog from './CloudConnectDialog.vue'
import type {
  CloudConnectError,
  CloudConnectStep,
  CloudServerKind,
  CloudSignInMethod
} from './types'

type Args = {
  step: CloudConnectStep
  kind: CloudServerKind
  address: string
  server: { host: string; methods: CloudSignInMethod[] } | null
  error: CloudConnectError | null
  device: { code: string; expiresIn: string } | null
  desktop: boolean
  onContinue: () => void
  onSignIn: (method: CloudSignInMethod) => void
}

const meta = {
  title: 'App/Cloud/Connect Dialog',
  tags: ['autodocs'],
  args: {
    step: 'server',
    kind: 'official',
    address: '',
    server: null,
    error: null,
    device: null,
    desktop: false,
    onContinue: fn(),
    onSignIn: fn()
  },
  render: (args) => ({
    components: { CloudConnectDialog },
    setup: () => ({ args, kind: ref(args.kind), address: ref(args.address) }),
    template: `
      <div class="h-[560px]">
        <CloudConnectDialog
          :open="true"
          v-model:kind="kind"
          v-model:address="address"
          official="cloud.openpencil.dev"
          :step="args.step"
          :server="args.server"
          :error="args.error"
          :device="args.device"
          :desktop="args.desktop"
          @continue="args.onContinue"
          @sign-in="args.onSignIn"
        />
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const ChooseServer: Story = {}

export const SelfHosted: Story = {
  args: { kind: 'self-hosted', address: 'https://cloud.studio.example' }
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
    server: { host: 'cloud.openpencil.dev', methods: ['google', 'apple', 'email'] }
  }
}

export const SignInOnDesktop: Story = {
  args: {
    step: 'sign-in',
    desktop: true,
    server: { host: 'cloud.studio.example', methods: ['google', 'email'] }
  }
}

export const ConfirmCodeOnDesktop: Story = {
  args: {
    step: 'device',
    desktop: true,
    server: { host: 'cloud.studio.example', methods: ['google'] },
    device: { code: 'WDJB-MJHT', expiresIn: '9:41' }
  }
}
