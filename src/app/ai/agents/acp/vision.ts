import { fromUint8Array } from 'js-base64'

import type { ACPAgentDef } from '@open-pencil/core/constants'

import { startAgentSession, type OneOffAgentOptions } from '@/app/ai/agents/acp/oneoff'
import type { ImageAttachmentMediaType } from '@/app/ai/attachment/image/types'

export interface AgentImageAnalysisOptions extends Omit<OneOffAgentOptions, 'onUpdate'> {
  instruction: string
  images: ReadonlyArray<{ mediaType: ImageAttachmentMediaType; data: Uint8Array }>
}

/**
 * What a coding agent says about images, from a session of its own that has no OpenPencil tools.
 * The agent exits, or `signal` stops it, instead of leaving the analysis waiting.
 */
export async function analyzeImagesWithAgent(
  agent: ACPAgentDef,
  { instruction, images, ...options }: AgentImageAnalysisOptions
): Promise<string> {
  let text = ''
  const session = await startAgentSession(agent, {
    ...options,
    onUpdate: (update) => {
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        text += update.content.text
      }
    }
  })
  try {
    if (!session.imageInput) throw new Error(`${agent.name} does not accept images.`)
    await session.untilStopped(
      session.connection.prompt({
        sessionId: session.opened.sessionId,
        prompt: [
          ...images.map(({ mediaType, data }) => ({
            type: 'image' as const,
            data: fromUint8Array(data),
            mimeType: mediaType
          })),
          { type: 'text', text: instruction }
        ]
      })
    )
    const description = text.trim()
    if (!description) throw new Error(`${agent.name} returned no description of the images.`)
    return description
  } finally {
    await session.close()
  }
}
