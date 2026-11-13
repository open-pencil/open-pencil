import type { ComarkPlugin } from 'comark'
import shiki from 'comark/plugins/shiki/core'
import bash from 'shiki/langs/bash.mjs'
import css from 'shiki/langs/css.mjs'
import html from 'shiki/langs/html.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import json from 'shiki/langs/json.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import vue from 'shiki/langs/vue.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'

/**
 * Highlights fenced code in the languages chat replies use. Each token carries both themes'
 * colors, the dark one as `--shiki-dark`, so the theme switches in CSS without parsing again.
 */
export function highlightPlugin(): ComarkPlugin {
  return shiki({
    languages: [bash, css, html, javascript, json, markdown, tsx, typescript, vue, yaml],
    themes: { light: githubLight, dark: githubDark },
    // The block's own text color, light and dark, for code outside any token.
    preStyles: true
  })
}
