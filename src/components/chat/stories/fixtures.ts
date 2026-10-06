import type { ChatStatus, UIMessage } from 'ai'

export interface Conversation {
  id: string
  title: string
  status: ChatStatus
  messages: UIMessage[]
}

export function conversations(): Conversation[] {
  return [
    {
      id: 'dashboard',
      title: 'Monthly expense dashboard',
      status: 'ready',
      messages: [
        {
          id: 'request',
          role: 'user',
          parts: [
            { type: 'text', text: 'Build an expense dashboard with summary cards and a chart.' }
          ]
        },
        {
          id: 'response',
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: 'I’ll inspect the frame, then arrange the summary cards and spending chart.',
              state: 'done'
            },
            {
              type: 'tool-create_frame',
              toolCallId: 'create-dashboard',
              state: 'output-available',
              input: { name: 'Expenses' },
              output: { id: 'frame-42', name: 'Expenses' }
            },
            {
              type: 'text',
              text: 'Created the **expense dashboard**.\n\n- Three summary cards\n- Monthly spending chart\n- Recent transactions\n\nWould you like a dark variant?'
            }
          ]
        }
      ]
    },
    {
      id: 'streaming',
      title: 'Explore a warmer color palette',
      status: 'streaming',
      messages: [
        {
          id: 'palette-request',
          role: 'user',
          parts: [{ type: 'text', text: 'Try a warmer palette, keeping the text accessible.' }]
        },
        {
          id: 'palette-response',
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: 'Comparing contrast ratios against the cream background…',
              state: 'streaming'
            },
            {
              type: 'tool-set_fills',
              toolCallId: 'palette',
              state: 'input-available',
              input: { color: '#fef3c7' }
            }
          ]
        }
      ]
    },
    {
      id: 'error',
      title: 'Update a layer that no longer exists',
      status: 'error',
      messages: [
        {
          id: 'error-request',
          role: 'user',
          parts: [{ type: 'text', text: 'Rename the selected layer.' }]
        },
        {
          id: 'error-response',
          role: 'assistant',
          parts: [
            {
              type: 'tool-rename_node',
              toolCallId: 'rename',
              state: 'output-error',
              input: { id: 'deleted-layer' },
              errorText: 'The selected layer no longer exists.'
            },
            {
              type: 'text',
              text: 'I couldn’t find that layer. Select another layer and try again.'
            }
          ]
        }
      ]
    },
    {
      id: 'reverted',
      title: 'Blue header',
      status: 'ready',
      messages: [
        {
          id: 'reverted-request',
          role: 'user',
          parts: [{ type: 'text', text: 'Make the header blue.' }]
        },
        {
          id: 'reverted-response',
          role: 'assistant',
          // Reverted from the chat; conversations store the mark in the reply's metadata.
          metadata: { reverted: true },
          parts: [
            {
              type: 'tool-set_fill',
              toolCallId: 'fill',
              state: 'output-available',
              input: { id: 'header', color: '#2563eb' },
              output: { id: 'header', name: 'Header' }
            },
            { type: 'text', text: 'The header is now blue.' }
          ]
        }
      ]
    },
    { id: 'empty', title: 'New chat', status: 'ready', messages: [] },
    {
      id: 'long-title',
      title:
        'Review the complete onboarding flow across desktop and mobile, including accessibility and empty states',
      status: 'ready',
      messages: []
    }
  ]
}

export const profileOptions = [
  { value: 'balanced', label: 'Balanced (mock)' },
  { value: 'fast', label: 'Fast (mock)' }
]
