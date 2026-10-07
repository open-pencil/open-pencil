// Hands OpenRouter's redirect to the desktop app, which validates the state and exchanges the
// code for a key. The code is useless without the verifier, which never leaves the app.
const target = `openpencil://oauth/openrouter${window.location.search}`
document.getElementById('return')?.setAttribute('href', target)
window.location.replace(target)
