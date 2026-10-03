import type { Meta, StoryObj } from '@storybook/vue3-vite'

import type { ToolCallPart } from '@/app/ai/chat/tool-calls/display'

import ToolCallGroup from './ToolCallGroup.vue'

const PREVIEW_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAGAAAAA4CAYAAAACRf2iAAAAgElEQVR42u3boQ0AIAxE0e5Kwv4VCBRMQCqbkCf+Avf0Ra591FcYAQAAAQAgAAAEAIAAAKgaM/UIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAActIDIAAABACAAAAQgH+7S7Yd8vOtmqgAAAAASUVORK5CYII='

const JSX = `<Frame name="Pricing" w={1200} flex="col" gap={32} p={64} bg="#FFFFFF">
  <Text size={40} weight="bold">Simple pricing</Text>
  <Frame flex="row" gap={24}>
    <Frame name="Starter" w="fill" p={24} rounded={16} bg="#F1F5F9" />
  </Frame>
</Frame>`

function part(fields: Record<string, unknown>): ToolCallPart {
  return { state: 'input-available', input: {}, ...fields } as ToolCallPart
}

const rendered = part({
  type: 'tool-render',
  toolCallId: 'render',
  state: 'output-available',
  input: { jsx: JSX },
  output: { id: '12:4', name: 'Pricing', children: 3 }
})

const streaming = part({
  type: 'tool-render',
  toolCallId: 'render-streaming',
  state: 'input-streaming',
  input: { jsx: JSX.slice(0, 140) }
})

const exported = part({
  type: 'tool-export_image',
  toolCallId: 'export',
  state: 'output-available',
  input: { ids: ['12:4'], maxEdge: 640 },
  output: { base64: PREVIEW_PNG, mimeType: 'image/png', width: 96, height: 56 }
})

const failed = part({
  type: 'tool-set_fill',
  toolCallId: 'failed',
  state: 'output-available',
  input: { id: '99:1', color: '#3B82F6' },
  output: { error: 'Node "99:1" not found' }
})

const described = part({
  type: 'tool-describe',
  toolCallId: 'describe',
  state: 'output-available',
  input: { id: '12:4', depth: 2 },
  output: { id: '12:4', role: 'section', issues: ['Text overflows its frame'] }
})

interface Args {
  parts: ToolCallPart[]
}

const meta = {
  title: 'Chat/Tool calls',
  component: ToolCallGroup,
  args: { parts: [rendered] },
  render: (args) => ({
    components: { ToolCallGroup },
    setup: () => ({ args }),
    template: '<div class="w-80"><ToolCallGroup v-bind="args" /></div>'
  })
} satisfies Meta<Args>
export default meta
type Story = StoryObj<Omit<typeof meta, 'component'>>

export const Rendered: Story = {}
export const StreamingRender: Story = { args: { parts: [streaming] } }
export const ExportedImage: Story = { args: { parts: [exported] } }
export const Failed: Story = { args: { parts: [failed] } }
export const LongRun: Story = {
  args: { parts: [described, rendered, failed, exported, { ...streaming, toolCallId: 'last' }] }
}
