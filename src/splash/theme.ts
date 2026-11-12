import { readStoredTheme, resolveAppTheme } from '@/app/settings/theme'

// The splash's stylesheet builds with this script, and each page inlines both.
import './style.css'

// Runs inline in each page's head, before anything paints (`vite/boot-splash`), so the splash and
// the page start in the theme the page will take.
document.documentElement.dataset.theme = resolveAppTheme(
  readStoredTheme(),
  matchMedia('(prefers-color-scheme: dark)').matches
)
