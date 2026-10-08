import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, within } from 'storybook/test'

import { planOnboarding, roleOptions } from '@/app/ai/models/settings/onboarding/plan'
import type { AIModelRole } from '@/app/ai/models/types'

import AISetupRoles from './AISetupRoles.vue'

interface Args {
  isRecommended: boolean
}

const plan = planOnboarding(
  { goals: ['design', 'vision'], access: ['openrouter'], spending: 'existing' },
  { agentsAvailable: false }
)

const meta = {
  title: 'App/Settings/AI Setup/Roles',
  args: { isRecommended: true },
  render: (args) => ({
    components: { AISetupRoles },
    setup: () => ({
      args,
      plan,
      options: (role: AIModelRole) => roleOptions(role, plan, [])
    }),
    template:
      '<div class="flex w-[34rem] max-w-full flex-col gap-3"><AISetupRoles v-bind="args" :plan="plan" :options="options" /></div>'
  })
} satisfies Meta<Args>

export default meta
type Story = StoryObj<typeof meta>

export const RecommendedOpenRouter: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: 'Fast tasks' })).not.toHaveTextContent(
      'Same as Design'
    )
    await expect(canvas.queryByRole('button', { name: 'Use recommended setup' })).toBeNull()
  }
}
export const ChangedFromRecommended: Story = { args: { isRecommended: false } }
