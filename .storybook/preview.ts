import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Preview, Renderer } from '@storybook/vue3-vite'
import { ConfigProvider } from 'reka-ui'
import { computed, watch } from 'vue'

// Points Core at the engine files the openPencil() Vite plugin serves.
import '@/app/editor/canvas/canvaskit'
import { registerInterfaceFont } from '@/app/editor/fonts/interface'
import { useAppTheme } from '@/app/shell/theme'
import '@/app.css'

registerInterfaceFont()

const preview: Preview = {
  globalTypes: {
    direction: {
      description: 'Interface direction, as Arabic mirrors it',
      toolbar: {
        title: 'Direction',
        icon: 'transfer',
        items: [
          { value: 'ltr', title: 'Left to right' },
          { value: 'rtl', title: 'Right to left' }
        ],
        dynamicTitle: true
      }
    }
  },
  initialGlobals: { direction: 'ltr' },
  decorators: [
    // As App.vue does: the document's direction for CSS, and Reka's for its components.
    (story, context) => ({
      components: { story, ConfigProvider },
      setup() {
        const dir = computed(() => (context.globals.direction === 'rtl' ? 'rtl' : 'ltr'))
        watch(dir, (value) => document.documentElement.setAttribute('dir', value), {
          immediate: true
        })
        return { dir }
      },
      template: '<ConfigProvider :dir="dir"><story /></ConfigProvider>'
    }),
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
        // Design System follows the families under src/components/ui; App follows product areas.
        order: [
          'Design System',
          [
            'Actions',
            'Inputs',
            'Selection',
            'Feedback',
            'Overlays',
            'Layout',
            'Lists',
            'Navigation',
            'Paint'
          ],
          'App',
          [
            'Editor',
            ['Navigation', 'Layer Tree', 'Properties'],
            'Chat',
            ['Markdown', 'Message', 'Attachments'],
            'Collaboration',
            'Settings',
            'Home',
            'Shell',
            'Brand'
          ],
          'Vue SDK',
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
          '[data-contrast-sample]'
        ]
      }
    }
  }
}

export default preview
