import { afterEach, describe, expect, expectTypeOf, test } from 'bun:test'

import {
  PROMPT_DEFINITIONS,
  TEMPLATE_PROMPTS,
  type PromptVariables
} from '@/app/ai/prompts/definitions'
import { checkTemplate, previewPrompt, renderPrompt } from '@/app/ai/prompts/engine'
import {
  appPreferences,
  DEFAULT_APP_PREFERENCES,
  updatePromptPreferences
} from '@/app/settings/preferences/store'

afterEach(() => {
  updatePromptPreferences(structuredClone(DEFAULT_APP_PREFERENCES.prompts))
})

describe('a prompt', () => {
  test('is the person’s own template, filled in, once they wrote one', async () => {
    updatePromptPreferences({ title: 'Name it after {{ request }}.' })
    expect(await renderPrompt('title', { request: 'cards', reply: 'done' })).toBe(
      'Name it after cards.'
    )
  })

  test('is the built-in one while the person wrote none', async () => {
    const builtIn = await renderPrompt('title', { request: 'cards', reply: 'done' })
    updatePromptPreferences({ title: '{{ request }}' })
    expect(await renderPrompt('title', { request: 'cards', reply: 'done' })).not.toBe(builtIn)
    updatePromptPreferences({ title: null })
    expect(await renderPrompt('title', { request: 'cards', reply: 'done' })).toBe(builtIn)
  })

  test('falls back to the built-in one when the person’s cannot render', async () => {
    const builtIn = await renderPrompt('title', { request: 'cards', reply: 'done' })
    updatePromptPreferences({ title: '{% if request %}never closed' })
    expect(await renderPrompt('title', { request: 'cards', reply: 'done' })).toBe(builtIn)
  })

  test('keeps at most one blank line where tags stood', async () => {
    updatePromptPreferences({ title: 'One\n{% if reply %}\n\n\nTwo{% endif %}\n\n\n\nThree' })
    expect(await renderPrompt('title', { request: '', reply: 'x' })).toBe('One\n\nTwo\n\nThree')
  })

  test('previews with the sample values its definition gives', async () => {
    expect(await previewPrompt('title', '{{ request }}')).toBe(
      String(PROMPT_DEFINITIONS.title.variables.request)
    )
  })
})

describe('the values a prompt is filled with', () => {
  test('are typed by its definition, so code passes exactly those', () => {
    expectTypeOf<PromptVariables<'title'>>().toEqualTypeOf<{ request: string; reply: string }>()
    expectTypeOf<PromptVariables<'review'>>().toEqualTypeOf<{
      language: string
      focus: string
      sees_images: boolean
      references: number
      edit: boolean
    }>()
    expectTypeOf<Parameters<typeof renderPrompt<'title'>>[1]>().toEqualTypeOf<
      PromptVariables<'title'>
    >()
  })
})

describe('checking a template', () => {
  test('reports what stops it rendering, where it is', async () => {
    const check = await checkTemplate('title', 'Hello\n{% if request %}open')
    expect(check.errors).toHaveLength(1)
    expect(check.errors[0]?.line).toBe(2)
  })

  test('reports variables the prompt does not offer, but not ones the template sets', async () => {
    const check = await checkTemplate(
      'title',
      '{{ request }} {{ nope | upper }}\n{% set mine = reply %}{{ mine }}{% for x in items %}{{ x }}{% endfor %}'
    )
    expect(check.errors).toEqual([])
    expect(check.unknownVariables.map(({ message }) => message)).toEqual(['nope', 'items'])
    expect(check.unknownVariables[0]?.line).toBe(1)
  })

  test('knows the variables Knap gives each loop', async () => {
    const check = await checkTemplate(
      'title',
      '{% for word in words %}{{ loop.index }} {{ word_index }} {{ word }}{% endfor %}'
    )
    expect(check.unknownVariables.map(({ message }) => message)).toEqual(['words'])
  })

  test('reports a template that parses but fails on its values', async () => {
    const check = await checkTemplate('title', '{% for x in request %}{{ x }}{% endfor %}')
    expect(check.errors.length).toBeGreaterThan(0)
  })

  test('leaves the values it is given as they were', async () => {
    const variables = { request: 'cards', reply: 'done' }
    updatePromptPreferences({ title: '{% set request = "changed" %}{{ request }}' })
    await renderPrompt('title', variables)
    expect(variables).toEqual({ request: 'cards', reply: 'done' })
  })

  test.each([...TEMPLATE_PROMPTS])(
    'finds nothing wrong with the built-in %s prompt',
    async (id) => {
      expect(await checkTemplate(id, PROMPT_DEFINITIONS[id].template)).toEqual({
        errors: [],
        unknownVariables: []
      })
    }
  )

  test.each([
    { edit: true, sees_images: true, references: 0 },
    { edit: true, sees_images: false, references: 0 },
    { edit: false, sees_images: false, references: 0 },
    { edit: false, sees_images: true, references: 2 }
  ])('renders the built-in review prompt for %p', async (variables) => {
    const text = await renderPrompt('review', { language: 'English', focus: '', ...variables })
    expect(text.length).toBeGreaterThan(0)
    expect(text).not.toMatch(/\n{3,}/)
    expect(appPreferences.value.prompts.review).toBeNull()
  })
})
