import { describe, expect, test } from 'bun:test'

import { lint, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = '@open-pencil/data/no-raw-runtime-effect'
const rules = { [rule]: 'error' }

describe('@open-pencil/data/no-raw-runtime-effect', () => {
  test.each([
    'ck.RuntimeEffect.Make(source)',
    'ck.RuntimeEffect.MakeForBlender(source, onError)',
    "r.ck.RuntimeEffect['Make'](source)",
    'RuntimeEffect.MakeForColorFilter(source)'
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    'compiledProgram(ck, shaders, PROGRAM)',
    'ck.Shader.MakeLinearGradient(start, end, colors, positions, mode)',
    'effect.makeShader(uniforms)'
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})
