import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, waitFor } from 'storybook/test'
import { ref } from 'vue'

import type { TemplateCheck } from '@/app/ai/prompts/engine'

import PromptEditor from './PromptEditor.vue'
import type { TemplateVariable } from './template-assist'

type PromptEditorArgs = {
  modelValue: string
  label: string
  template?: boolean
  check?: TemplateCheck | null
  variables?: Readonly<Record<string, TemplateVariable>>
  placeholder?: string
}

const meta = {
  title: 'App/Settings/Prompt Editor',
  component: PromptEditor,
  parameters: { layout: 'centered' },
  render: (args) => ({
    components: { PromptEditor },
    setup: () => {
      const text = ref(args.modelValue)
      return { args, text }
    },
    template:
      '<div class="w-[32rem] bg-panel p-4"><PromptEditor v-bind="args" v-model="text" :unknown-variable-message="(name) => name + \' is not a variable\'" /></div>'
  })
} satisfies Meta<PromptEditorArgs>

export default meta
type Story = StoryObj<PromptEditorArgs>

/**
 * A Knap template, with a variable its prompt does not offer underlined; its variables complete
 * and show their sample values on hover.
 */
export const Template: Story = {
  args: {
    label: 'Chat titles',
    template: true,
    modelValue: 'Name this conversation.\n\nRequest:\n{{ request }}\n\nAlso {{ nope }}.',
    check: { errors: [], unknownVariables: [{ message: 'nope', line: 6, column: 9 }] },
    variables: {
      request: {
        description: 'The conversation’s first request',
        sample: 'Make the pricing cards the same height'
      },
      reply: { description: 'The beginning of the first reply', sample: 'Done.' }
    }
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('.cm-lintRange-warning')).not.toBeNull())
  }
}

/** Plain Markdown instructions, empty, showing what to write. */
export const Instructions: Story = {
  args: {
    label: 'Design agent',
    modelValue: '',
    placeholder: 'For example: Use our 8px spacing scale.'
  }
}
