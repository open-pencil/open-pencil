import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview, Renderer } from '@storybook/vue3-vite'

import '../src/app.css'

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute<Renderer>({
      themes: {
        dark: 'dark',
        light: 'light'
      },
      defaultTheme: 'dark',
      attributeName: 'data-theme'
    }),
    (story) => ({
      components: { story },
      template:
        '<div class="min-h-screen bg-canvas p-8 text-surface [--vp-c-bg-alt:var(--color-panel-field)] [--vp-c-bg-soft:var(--color-panel)] [--vp-c-brand-1:var(--color-component)] [--vp-c-divider:var(--color-border)] [--vp-c-text-1:var(--color-surface)] [--vp-c-text-2:var(--color-muted)]"><story /></div>'
    })
  ],
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    a11y: {
      test: 'error'
    }
  }
}

export default preview
