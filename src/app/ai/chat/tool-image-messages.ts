import type { ImagePart, ModelMessage, ToolResultPart } from 'ai'

const TOOL_IMAGE_MESSAGE = 'The rendered canvas image is attached in the following user message.'

function extractImages(part: ToolResultPart): ImagePart[] {
  if (part.output.type !== 'content') return []

  return part.output.value.flatMap((item): ImagePart[] => {
    if (item.type === 'image-data' || item.type === 'media') {
      return [{ type: 'image', image: item.data, mediaType: item.mediaType }]
    }
    if (item.type === 'image-url') {
      return [{ type: 'image', image: new URL(item.url) }]
    }
    return []
  })
}

/**
 * Chat Completions only accepts text in tool-result messages. Move images into a
 * synthetic user message so OpenAI-compatible multimodal models can inspect them.
 */
export function moveToolImagesToUserMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.flatMap((message): ModelMessage[] => {
    if (message.role !== 'tool') return [message]

    const images = message.content.flatMap((part) =>
      part.type === 'tool-result' ? extractImages(part) : []
    )
    if (images.length === 0) return [message]

    return [
      {
        ...message,
        content: message.content.map((part) =>
          part.type === 'tool-result' && extractImages(part).length > 0
            ? { ...part, output: { type: 'text', value: TOOL_IMAGE_MESSAGE } }
            : part
        )
      },
      {
        role: 'user',
        content: [{ type: 'text', text: TOOL_IMAGE_MESSAGE }, ...images]
      }
    ]
  })
}
