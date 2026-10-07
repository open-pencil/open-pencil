import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview, Renderer } from '@storybook/vue3-vite'
import { watch } from 'vue'

import { useAppTheme } from '../src/app/shell/theme'

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
    (story, context) => ({
      components: { story },
      setup() {
        const { setTheme } = useAppTheme()
        watch(
          () => context.globals.theme,
          (theme) => setTheme(theme === 'light' ? 'light' : 'dark'),
          { immediate: true }
        )
      },
      template:
        '<div class="min-h-screen bg-canvas p-8 text-surface [--vp-c-bg-alt:var(--color-panel-field)] [--vp-c-bg-soft:var(--color-panel)] [--vp-c-brand-1:var(--color-component)] [--vp-c-divider:var(--color-border)] [--vp-c-text-1:var(--color-surface)] [--vp-c-text-2:var(--color-muted)]"><story /></div>'
    })
  ],
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: [
          'Design System',
          [
            'Actions',
            ['Button', 'Icon Button'],
            'Inputs',
            ['Combobox', 'Segmented Control'],
            'Navigation',
            ['Tabs'],
            'Lists',
            ['Action Row'],
            'Paint',
            ['Fill Swatch'],
            'Overlays',
            ['Dialog'],
            'Feedback',
            ['Placeholder', 'Toast'],
            'Layout',
            ['Panel Foundation']
          ],
          'Editor',
          ['Navigation', 'Layer Tree', 'Properties'],
          'Chat',
          ['Markdown', 'Message', 'Attachments'],
          '*'
        ]
      }
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    a11y: {
      test: 'error',
      context: {
        include: ['body'],
        exclude: [
          // Reka's toast viewport brackets its list with empty aria-hidden spans that only pass
          // focus into the toasts; they never keep it.
          '[role=region] > span[aria-hidden="true"][tabindex="0"]',
          // A row being dragged stays behind as a faded placeholder; the drag preview carries it.
          '[data-dragging]',
          // Design Check shows the document's own failing text and background colors as a sample.
          '[data-contrast-sample]',
          // A reverted reply is dimmed history whose edits are gone.
          '[data-reverted="true"]'
        ]
      }
    }
  }
}

export default preview
