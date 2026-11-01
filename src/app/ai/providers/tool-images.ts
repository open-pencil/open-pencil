import type { LanguageModelMiddleware } from 'ai'
import { partition } from 'es-toolkit'

type Prompt = Parameters<
  NonNullable<LanguageModelMiddleware['transformParams']>
>[0]['params']['prompt']
type PromptMessage = Prompt[number]
type ToolContent = Extract<PromptMessage, { role: 'tool' }>['content'][number]
type UserContent = Extract<PromptMessage, { role: 'user' }>['content'][number]
type ContentOutputPart = Extract<
  Extract<ToolContent, { type: 'tool-result' }>['output'],
  { type: 'content' }
>['value'][number]
type ImagePart = Extract<ContentOutputPart, { type: 'file' }>

function isImagePart(part: ContentOutputPart): part is ImagePart {
  return part.type === 'file' && part.mediaType.startsWith('image/')
}

/**
 * Chat Completions takes only text in a tool message, so the AI SDK sends a tool's image there as
 * its Base64 text. This moves each image into a user message after the step's tool results, as
 * opencode does; the same history always gives the same messages, so cached prefixes still match.
 */
export const toolImagesInUserMessage: LanguageModelMiddleware = {
  transformParams: async ({ params }) => {
    const prompt: Prompt = []
    for (const message of params.prompt) {
      if (message.role !== 'tool') {
        prompt.push(message)
        continue
      }
      const images: UserContent[] = []
      const content = message.content.map((part): ToolContent => {
        if (part.type !== 'tool-result' || part.output.type !== 'content') return part
        const [moved, rest] = partition(part.output.value, isImagePart)
        if (moved.length === 0) return part
        images.push(
          { type: 'text', text: `Images from the ${part.toolName} call ${part.toolCallId}:` },
          ...moved.map(({ data, mediaType, filename }) => ({
            type: 'file' as const,
            data,
            mediaType,
            filename
          }))
        )
        // Text alone goes as text; a content list would be sent as its JSON.
        const text = rest.flatMap((item) => (item.type === 'text' ? [item.text] : []))
        text.push('The images follow in the next user message.')
        return { ...part, output: { type: 'text', value: text.join('\n') } }
      })
      prompt.push({ ...message, content })
      if (images.length > 0) prompt.push({ role: 'user', content: images })
    }
    return { ...params, prompt }
  }
}
