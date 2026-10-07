import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'

import {
  aiModelSettings,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  type AIModelSettings
} from '@/app/ai/models'
import { AppDialogRoot } from '@/components/ui/dialog'

import AISetupFlow from './AISetupFlow.vue'

interface Args {
  entry: 'welcome' | 'guided'
  agentsAvailable: boolean
}

const freshInstall: AIModelSettings = {
  version: 1,
  connections: [
    {
      id: 'connection-default',
      providerID: 'openai-compatible',
      customBaseURL: '',
      customAPIType: 'completions',
      credentialProfileId: 'default'
    }
  ],
  models: [
    {
      id: 'model-default',
      name: 'Design model',
      connectionId: 'connection-default',
      modelID: '',
      customModelID: '',
      maxOutputTokens: 16_384,
      thinkingLevel: 'default',
      capabilities: ['tools']
    }
  ],
  assignments: { design: 'model-default', review: 'design', fast: 'design', vision: null }
}

const meta = {
  title: 'App/Settings/AI Setup/Guided Setup',
  args: { entry: 'guided', agentsAvailable: false },
  parameters: {
    docs: {
      description: {
        component:
          'Skippable guided setup over the same model settings that Settings → AI edits directly. Each story starts from fresh-install settings and restores the previous ones afterwards.'
      }
    }
  },
  beforeEach: () => {
    const previous = modelSettingsSnapshot()
    replaceAIModelSettings(freshInstall)
    return () => replaceAIModelSettings(previous)
  },
  render: (args) => ({
    components: { AppDialogRoot, AISetupFlow },
    setup: () => ({ args }),
    template: '<AppDialogRoot :open="true" size="md"><AISetupFlow v-bind="args" /></AppDialogRoot>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

const page = () => within(document.body)

async function choose(name: string | RegExp) {
  await userEvent.click(page().getByRole('checkbox', { name }))
}

async function next() {
  await userEvent.click(page().getByRole('button', { name: 'Continue' }))
}

export const Welcome: Story = { args: { entry: 'welcome' } }
export const Goals: Story = {}
export const AccessInBrowser: Story = {
  play: async () => {
    await next()
    await expect(page().getByRole('checkbox', { name: 'OpenRouter' })).toBeVisible()
    await expect(page().queryByRole('checkbox', { name: 'Claude Code' })).toBeNull()
  }
}
export const AccessOnDesktop: Story = {
  args: { agentsAvailable: true },
  play: async () => {
    await next()
    await expect(page().getByRole('checkbox', { name: 'Claude Code' })).toBeVisible()
  }
}

export const ConnectAgentAndFinish: Story = {
  args: { agentsAvailable: true },
  play: async () => {
    await next()
    await choose('Codex')
    await next()
    // Codex covers the design goal, so there is no pay-as-you-go question.
    await expect(page().getByRole('heading', { name: 'Connect your AI' })).toBeVisible()
    await expect(page().getByText('npm i -g @agentclientprotocol/codex-acp')).toBeVisible()
    await next()
    await expect(page().getByText('Codex · Model chosen by the agent')).toBeVisible()
    await userEvent.click(page().getByRole('button', { name: 'Finish setup' }))
    await expect(page().getByRole('heading', { name: 'AI is ready' })).toBeVisible()
    await expect(aiModelSettings.value.models.map((profile) => profile.name)).toEqual(['Codex'])
  }
}

export const RecommendOpenRouter: Story = {
  play: async () => {
    await choose(/Review designs visually/)
    await next()
    await next()
    await userEvent.click(page().getByRole('button', { name: 'Add OpenRouter (pay as you go)' }))
    await expect(page().getByRole('button', { name: 'Sign in with OpenRouter' })).toBeVisible()
    await expect(page().getByRole('button', { name: 'Continue' })).toBeDisabled()
  }
}

export const NothingCovered: Story = {
  play: async () => {
    await next()
    await next()
    await expect(page().getByRole('button', { name: 'Continue' })).toBeDisabled()
    await expect(
      page().getByRole('button', { name: 'Add OpenRouter (pay as you go)' })
    ).toBeVisible()
  }
}

export const ServerWithoutVision: Story = {
  play: async () => {
    await choose(/Review designs visually/)
    await next()
    await choose('Local model or company server')
    await next()
    const addOpenRouter = () =>
      page().queryByRole('button', { name: 'Add OpenRouter (pay as you go)' })
    await expect(addOpenRouter()).toBeVisible()
    await choose('This model can read images')
    await expect(addOpenRouter()).toBeNull()
  }
}
