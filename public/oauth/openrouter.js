// Relays OpenRouter's redirect to the editor that started sign-in, which validates the state,
// exchanges the code for a key, and closes this window.
const channel = new BroadcastChannel('open-pencil:openrouter-oauth')
channel.postMessage(window.location.search)
channel.close()
window.close()
