import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT = 'scripts/i18n/audit-views.ts'

function runAuditOnSample(content: string): { stdout: string; output: string } {
  const tmp = mkdtempSync(join(tmpdir(), 'i18n-audit-'))
  try {
    const viewsDir = join(tmp, 'src', 'views')
    const docsDir = join(tmp, 'docs')
    const outPath = join(tmp, 'docs/i18n-audit.md')

    // Copy the script with VIEWS_DIR / OUTPUT replaced to point at our tmp tree.
    const original = readFileSync(SCRIPT, 'utf8')
    const scriptPath = join(tmp, 'audit.ts')
    writeFileSync(
      scriptPath,
      original
        .replace(
          "const VIEWS_DIR = 'src/views'",
          `const VIEWS_DIR = '${viewsDir.replace(/\\/g, '\\\\')}'`
        )
        .replace(
          "const OUTPUT = 'docs/i18n-audit.md'",
          `const OUTPUT = '${outPath.replace(/\\/g, '\\\\')}'`
        )
    )

    require('node:fs').mkdirSync(viewsDir, { recursive: true })
    require('node:fs').mkdirSync(docsDir, { recursive: true })
    writeFileSync(join(viewsDir, 'Sample.vue'), content)

    const result = spawnSync('bun', [scriptPath], { encoding: 'utf8' })
    const output = readFileSync(outPath, 'utf8')
    return { stdout: result.stdout, output }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

describe('i18n audit-views', () => {
  test('detects English text inside template blocks', () => {
    const { output } = runAuditOnSample(`
<template>
  <h1>
    Quick actions
  </h1>
  <p>
    Start a new board or jump to a workspace
  </p>
  <button>
    New board
  </button>
</template>
`)
    expect(output).toContain('Quick actions')
    expect(output).toContain('Start a new board or jump to a workspace')
    expect(output).toContain('New board')
  })

  test('captures placeholder/aria-label/title attribute strings', () => {
    const { output } = runAuditOnSample(`
<template>
  <input placeholder="Search by name" />
  <button aria-label="Toggle settings">⚙</button>
  <span title="Member count">42</span>
</template>
`)
    expect(output).toContain('Search by name')
    expect(output).toContain('Toggle settings')
    expect(output).toContain('Member count')
  })

  test('ignores content already rendered via interpolation', () => {
    const { output } = runAuditOnSample(`
<template>
  <p>{{ message }}</p>
  <p>{{ count }} boards</p>
</template>
`)
    expect(output).not.toContain('{{ message }}')
  })

  test('writes the priorities section listing the top three files', () => {
    const { output } = runAuditOnSample(`
<template>
  <h1>
    Lorem ipsum dolor sit amet
  </h1>
  <input placeholder="Search anything" />
</template>
`)
    expect(output).toContain('## Next i18n migration priorities')
    expect(output).toContain('Sample.vue —')
  })

  test('ignores bound attribute expressions like :aria-label / :placeholder / :title', () => {
    const { output } = runAuditOnSample(`
<template>
  <button :aria-label="formatTemplate(dashboard.customize.dragHandleAria, { section: id })">drag</button>
  <span :aria-label="isPinned(board.id) ? dashboard.pinAria.unpin : dashboard.pinAria.pin">pin</span>
  <input :placeholder="boardsT.searchPlaceholder" />
  <abbr :title="boardsT.tooltipText">hover</abbr>
</template>
`)
    expect(output).not.toContain('formatTemplate(')
    expect(output).not.toContain('isPinned(')
    expect(output).not.toContain('boardsT.searchPlaceholder')
    expect(output).not.toContain('boardsT.tooltipText')
  })

  test('keeps detecting static placeholder / aria-label / title literals when no binding prefix is present', () => {
    const { output } = runAuditOnSample(`
<template>
  <input placeholder="Search boards" />
  <button aria-label="Toggle pin">pin</button>
  <abbr title="Hover hint">x</abbr>
</template>
`)
    expect(output).toContain('Search boards')
    expect(output).toContain('Toggle pin')
    expect(output).toContain('Hover hint')
  })

  test('shows a completion notice in the priorities section when all views are clean', () => {
    const { output } = runAuditOnSample(`
<template>
  <p>{{ alreadyI18n }}</p>
</template>
`)
    expect(output).toContain('## Next i18n migration priorities')
    expect(output).toContain('All views are fully i18n-ready')
    expect(output).not.toContain('— 0 candidates')
  })
})
