import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { ProjectRunState } from '@/app/projects/runner'
import ProjectApplication from '@/components/project/ProjectApplication.vue'

/** The panel's props, named here so the stories do not depend on SFC type inference. */
type PanelArgs = {
  command: string
  state: ProjectRunState
  address: string
  output: string[]
  failure: string | null
  exitCode: number | null
}

/** A page of its own, so the frame shows something without a dev server running. */
const ADDRESS =
  'data:text/html;charset=utf-8,%3Cbody%20style%3D%22margin%3A0%3Bfont-family%3Asans-serif%3Bpadding%3A1.5rem%22%3E%3Ch1%20style%3D%22margin%3A0%200%20.5rem%22%3EKarbid%3C%2Fh1%3E%3Cp%20style%3D%22color%3A%23444%22%3EShowcase%20of%20the%20design%20system%3C%2Fp%3E%3C%2Fbody%3E'

const output = [
  '> pnpm --filter @karbid/showcase dev',
  '> @karbid/showcase dev',
  '> nuxt dev --port 3000',
  '  ➜ Local:    http://localhost:3000/',
  '  ➜ Network:  use --host to expose',
  '✔ Vite server built in 1204ms'
]

const meta = {
  title: 'App/Project/Application',
  component: ProjectApplication,
  parameters: {
    docs: {
      description: {
        component:
          'The application a project holds: the command that starts it, how the run is going, what it printed, and the frame that shows it. useProjectRunner owns the process; this panel renders it.'
      }
    }
  },
  args: {
    command: 'pnpm --filter @karbid/showcase dev',
    state: 'idle',
    address: '',
    output: [],
    failure: null,
    exitCode: null
  },
  render: (args: PanelArgs) => ({
    components: { ProjectApplication },
    setup: () => ({ args }),
    template:
      '<div class="flex h-[32rem] w-[34rem] flex-col bg-canvas p-4 text-surface"><ProjectApplication v-bind="args" /></div>'
  })
} satisfies Meta<PanelArgs>

export default meta
type Story = StoryObj<PanelArgs>

export const NotStarted: Story = {}

export const Running: Story = { args: { state: 'running', address: ADDRESS, output } }

export const Starting: Story = { args: { state: 'starting' } }

export const Stopped: Story = { args: { state: 'stopped', exitCode: 0, output } }

export const Failed: Story = {
  args: { state: 'failed', failure: 'the project path is not a directory' }
}

export const NoCommand: Story = { args: { command: '' } }
