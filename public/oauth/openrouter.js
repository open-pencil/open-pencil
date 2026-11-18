// Relays OpenRouter's redirect to the editor that started sign-in, which validates the state,
// exchanges the code for a key, and closes this window.
const channel = new BroadcastChannel('open-pencil:openrouter-oauth')
// A BroadcastChannel reaches only this origin's documents, so its postMessage takes no target origin.
// oxlint-disable-next-line unicorn/require-post-message-target-origin
channel.postMessage(window.location.search)
channel.close()
window.close()
