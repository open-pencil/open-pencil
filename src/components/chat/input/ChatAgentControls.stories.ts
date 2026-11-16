import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect } from 'storybook/test'

import type { AgentChoices, AgentModelChoices } from '@/app/ai/agents/acp/options'
import { agentSessionChoices, chooseAgentOptions } from '@/app/ai/chat/thinking'
import {
  modelSettingsSnapshot,
  replaceAIModelSettings,
  type AIModelProfileId,
  type AIModelSettings
} from '@/app/ai/models'

import ChatAgentAccess from './ChatAgentAccess.vue'
import ChatAgentModelMenu from './ChatAgentModelMenu.vue'
import ChatAgentModeSelect from './ChatAgentModeSelect.vue'

/** What Codex offers: its thinking levels, its sandbox presets as access, and Plan as its mode. */
const CODEX: AgentModelChoices = {
  thought_level: {
    name: 'Reasoning effort',
    current: 'medium',
    values: ['low', 'medium', 'high', 'max', 'ultra'].map((id) => ({
      id,
      name: id[0].toUpperCase() + id.slice(1)
    }))
  },
  mode: {
    name: 'Mode',
    current: 'agent',
    values: [
      { id: 'read-only', name: 'Read-only' },
      { id: 'agent', name: 'Auto review' },
      { id: 'agent-full-access', name: 'Full access' }
    ]
  },
  collaboration_mode: {
    name: 'Collaboration mode',
    current: 'default',
    values: [
      { id: 'default', name: 'Default' },
      { id: 'plan', name: 'Plan', description: 'Plan before making changes' }
    ]
  }
}

/** One Codex profile on the Design role, so each story keeps its own composer choices. */
function codexSettings(profileId: AIModelProfileId, name = 'Codex'): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-codex',
        providerID: 'acp:codex',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: ''
      }
    ],
    models: [
      {
        id: profileId,
        name,
        connectionId: 'connection-codex',
        modelID: '',
        customModelID: '',
        maxOutputTokens: 16384,
        thinkingLevel: 'default',
        capabilities: ['tools']
      }
    ],
    assignments: { design: profileId, review: 'design', fast: 'design', vision: null }
  }
}

interface Args {
  /** The profile's name, which a long one shortens in the row. */
  name?: string
  /** The composer's model area, as narrow and wide chat panels leave it. */
  width: string
  choices: AgentChoices
  profileId: AIModelProfileId
}

const meta = {
  title: 'App/Chat/Agent Controls',
  beforeEach: (context) => {
    const { profileId, choices, name } = context.args
    const previous = modelSettingsSnapshot()
    replaceAIModelSettings(codexSettings(profileId, name))
    // The session opened on Codex's own values, which a changed choice differs from.
    agentSessionChoices.value = {
      profileId,
      choices: CODEX,
      defaults: { thought_level: 'medium', mode: 'agent', collaboration_mode: 'default' }
    }
    chooseAgentOptions(choices)
    return () => {
      agentSessionChoices.value = null
      replaceAIModelSettings(previous)
    }
  },
  render: (args) => ({
    components: { ChatAgentAccess, ChatAgentModelMenu, ChatAgentModeSelect },
    setup: () => ({ args }),
    template: `
      <div class="rounded-xl bg-input p-2" :style="{ width: args.width }">
        <div data-slot="agent-controls" class="@container flex min-w-0 items-center gap-0.5">
          <ChatAgentModeSelect category="collaboration_mode" />
          <ChatAgentAccess category="mode" />
          <span class="flex-1" />
          <ChatAgentModelMenu access="mode" />
        </div>
      </div>`
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

/** Every control sits inside the row, whatever the width leaves it. */
async function expectFits(canvasElement: HTMLElement): Promise<void> {
  const row = canvasElement.querySelector('[data-slot="agent-controls"]')
  if (!(row instanceof HTMLElement)) throw new Error('No agent controls')
  const { left, right } = row.getBoundingClientRect()
  for (const child of row.children) {
    const box = child.getBoundingClientRect()
    await expect(box.left).toBeGreaterThanOrEqual(left - 0.5)
    await expect(box.right).toBeLessThanOrEqual(right + 0.5)
  }
}

const planning: AgentChoices = {
  collaboration_mode: 'plan',
  mode: 'agent-full-access',
  thought_level: 'ultra'
}

export const Extended: Story = {
  args: { width: '22rem', choices: {}, profileId: 'model-codex-extended' },
  play: async ({ canvasElement }) => {
    await expectFits(canvasElement)
    const model = canvasElement.querySelector('[data-test-id="chat-agent-model"]')
    // The agent's own level goes unsaid; the name is enough.
    await expect(model).toHaveTextContent('Codex')
    await expect(model).not.toHaveTextContent('Medium')
    await expect(canvasElement.querySelector('[data-test-id="chat-agent-access"]')).toBeNull()
  }
}

export const ExtendedPlanning: Story = {
  args: { width: '22rem', choices: planning, profileId: 'model-codex-extended-plan' },
  play: async ({ canvasElement }) => {
    await expectFits(canvasElement)
    await expect(canvasElement.querySelector('[data-test-id="chat-agent-access"]')).toBeVisible()
  }
}

export const Compact: Story = {
  args: { width: '11rem', choices: planning, profileId: 'model-codex-compact' },
  play: async ({ canvasElement }) => {
    await expectFits(canvasElement)
    const model = canvasElement.querySelector('[data-test-id="chat-agent-model"]')
    // The narrow model control keeps the thinking level and leaves the agent's name to its menu.
    await expect(model).toHaveTextContent('Ultra')
    await expect(model?.querySelector('span')).not.toBeVisible()
  }
}

/** A long profile name on the agent's own level, the name being the model control's only word. */
export const CompactLongName: Story = {
  args: {
    width: '9rem',
    choices: {},
    profileId: 'model-codex-long',
    name: 'Codex for the design system'
  },
  play: async ({ canvasElement }) => {
    await expectFits(canvasElement)
  }
}
