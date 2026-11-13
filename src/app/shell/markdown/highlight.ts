import shiki from '@comark/vue/plugins/shiki'
import css from '@shikijs/langs/css'
import html from '@shikijs/langs/html'
import markdown from '@shikijs/langs/markdown'
import githubDark from '@shikijs/themes/github-dark'
import githubLight from '@shikijs/themes/github-light'

/**
 * Highlights fenced code with GitHub's light and dark themes; `markdown.css` switches between
 * them. Comark's default grammars (TypeScript, Vue, JSON, shell, and others) load on first use;
 * these add the ones replies about design use beside them.
 */
export const highlightPlugin = shiki({
  themes: { light: githubLight, dark: githubDark },
  languages: [css, html, markdown],
  // The block's own text color, light and dark, for code outside any token.
  preStyles: true
})
