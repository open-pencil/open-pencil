import type { ChatTransport, UIMessage } from 'ai'

/** The history a new request sends: partial tool activity stays in history, unpaired calls do not. */
export function requestMessages(messages: UIMessage[]): UIMessage[] {
  return messages
    .map((message) => ({
      ...message,
      parts: message.parts.filter(
        (part) =>
          !('toolCallId' in part) ||
          part.state === 'output-available' ||
          part.state === 'output-error' ||
          part.state === 'output-denied'
      )
    }))
    .filter((message) => message.parts.length > 0)
}

/** Preserve partial tool activity in history but omit unpaired calls from new requests. */
export function resumableTransport(transport: ChatTransport<UIMessage>): ChatTransport<UIMessage> {
  return {
    reconnectToStream: (options) => transport.reconnectToStream(options),
    sendMessages: (options) =>
      transport.sendMessages({ ...options, messages: requestMessages(options.messages) })
  }
}
