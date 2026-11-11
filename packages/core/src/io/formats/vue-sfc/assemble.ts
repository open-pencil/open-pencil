const STYLE_BLOCK = /<style[^>]*>([\s\S]*?)<\/style>/gi
const BODY = /<body[^>]*>([\s\S]*)<\/body>/i
const DOCUMENT_SHELL = /<!doctype[^>]*>|<\/?html[^>]*>|<\/?head[^>]*>[\s\S]*?<\/head>/gi

/**
 * The markup an HTML export builds, as a component a Nuxt project can drop in: the body becomes
 * the template, the stylesheet the export writes becomes the component's own style, and the
 * script setup stays empty until a caller has imports to add.
 */
export function htmlToVueSFC(html: string): string {
  const styles = [...html.matchAll(STYLE_BLOCK)].map((match) => match[1]).join('\n')
  const body = BODY.exec(html)?.[1] ?? html.replace(DOCUMENT_SHELL, '')
  // A stylesheet the markup carries is moved out with the others: left in the body it would sit in
  // the template as well as in the style block, which draws the rules twice and is not a template
  // Vue accepts. The default export path writes its stylesheet into the head, so this only bites a
  // caller that hands over a fragment.
  const template = body.replace(STYLE_BLOCK, '').trim()
  const parts = ['<template>', template, '</template>']
  parts.push('', '<script setup lang="ts">', '</script>')
  if (styles.trim() !== '') parts.push('', '<style>', styles.trim(), '</style>')
  return `${parts.join('\n')}\n`
}
