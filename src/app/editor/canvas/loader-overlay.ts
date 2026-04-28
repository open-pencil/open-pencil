const LOADER_FADE_OUT_MS = 300

export function fadeOutGlobalLoader() {
  const loader = document.getElementById('loader')
  if (!loader) return
  loader.classList.add('fade-out')
  setTimeout(() => loader.remove(), LOADER_FADE_OUT_MS)
}
