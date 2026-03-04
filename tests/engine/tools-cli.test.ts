import { describe, expect, test, setDefaultTimeout } from 'bun:test'

setDefaultTimeout(30_000)
import { join } from 'path'

const CLI = join(import.meta.dir, '../../packages/cli/src/index.ts')
const FIXTURE = join(import.meta.dir, '../fixtures/material3.fig')

async function evalCode(
  code: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['bun', CLI, 'eval', FIXTURE, '--code', code, '--json'], {
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text()
  ])
  const exitCode = await proc.exited
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

function parseJSON(stdout: string): unknown {
  return JSON.parse(stdout)
}

describe('CLI tool operations via eval', () => {
  test('create and read back a node', async () => {
    const { stdout, exitCode } = await evalCode(`
      const r = figma.createRectangle()
      r.name = 'TestRect'
      r.x = 100
      r.y = 200
      r.resize(300, 150)
      return r.toJSON()
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.name).toBe('TestRect')
    expect(result.x).toBe(100)
    expect(result.y).toBe(200)
    expect(result.width).toBe(300)
    expect(result.height).toBe(150)
  })

  test('set fill on a node', async () => {
    const { stdout, exitCode } = await evalCode(`
      const r = figma.createRectangle()
      r.resize(50, 50)
      r.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }]
      return { fills: r.fills }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.fills.length).toBe(1)
    expect(result.fills[0].color.r).toBe(1)
  })

  test('set layout on a frame', async () => {
    const { stdout, exitCode } = await evalCode(`
      const f = figma.createFrame()
      f.resize(300, 200)
      f.layoutMode = 'VERTICAL'
      f.itemSpacing = 16
      f.paddingLeft = 20
      f.paddingRight = 20
      f.paddingTop = 20
      f.paddingBottom = 20
      return {
        layoutMode: f.layoutMode,
        itemSpacing: f.itemSpacing,
        paddingLeft: f.paddingLeft
      }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.layoutMode).toBe('VERTICAL')
    expect(result.itemSpacing).toBe(16)
    expect(result.paddingLeft).toBe(20)
  })

  test('create component from node', async () => {
    const { stdout, exitCode } = await evalCode(`
      const f = figma.createFrame()
      f.name = 'Button'
      f.resize(200, 48)
      const comp = figma.createComponentFromNode(f)
      return { name: comp.name, type: comp.type }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.name).toBe('Button')
    expect(result.type).toBe('COMPONENT')
  })

  test('group and ungroup nodes', async () => {
    const { stdout, exitCode } = await evalCode(`
      const r1 = figma.createRectangle()
      r1.resize(50, 50)
      const r2 = figma.createRectangle()
      r2.resize(50, 50)
      const group = figma.group([r1, r2], figma.currentPage)
      const groupType = group.type
      const childCount = group.children.length
      figma.ungroup(group)
      const ungrouped = figma.getNodeById(group.id)
      return { groupType, childCount, ungroupedExists: ungrouped !== null }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.groupType).toBe('GROUP')
    expect(result.childCount).toBe(2)
    expect(result.ungroupedExists).toBe(false)
  })

  test('find nodes by type on fixture', async () => {
    const { stdout, exitCode } = await evalCode(`
      const texts = figma.currentPage.findAllWithCriteria({ types: ['TEXT'] })
      return { count: texts.length, hasTexts: texts.length > 0 }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.hasTexts).toBe(true)
    expect(result.count).toBeGreaterThan(0)
  })

  test('clone a node', async () => {
    const { stdout, exitCode } = await evalCode(`
      const r = figma.createRectangle()
      r.name = 'Original'
      r.resize(100, 100)
      const clone = r.clone()
      return {
        same: r.id === clone.id,
        cloneName: clone.name,
        cloneWidth: clone.width
      }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.same).toBe(false)
    expect(result.cloneName).toBe('Original')
    expect(result.cloneWidth).toBe(100)
  })

  test('reparent node into frame', async () => {
    const { stdout, exitCode } = await evalCode(`
      const frame = figma.createFrame()
      frame.resize(300, 300)
      const rect = figma.createRectangle()
      rect.resize(50, 50)
      frame.appendChild(rect)
      return {
        parentId: rect.parent?.id,
        isChild: frame.children.some(c => c.id === rect.id)
      }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.isChild).toBe(true)
  })

  test('set constraints', async () => {
    const { stdout, exitCode } = await evalCode(`
      const r = figma.createRectangle()
      r.resize(100, 100)
      r.constraints = { horizontal: 'CENTER', vertical: 'STRETCH' }
      return r.constraints
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.horizontal).toBe('CENTER')
    expect(result.vertical).toBe('STRETCH')
  })

  test('set effects', async () => {
    const { stdout, exitCode } = await evalCode(`
      const f = figma.createFrame()
      f.resize(100, 100)
      f.effects = [{
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.25 },
        offset: { x: 0, y: 4 },
        radius: 8,
        spread: 0,
        visible: true
      }]
      return { count: f.effects.length, type: f.effects[0].type }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.count).toBe(1)
    expect(result.type).toBe('DROP_SHADOW')
  })

  test('list variables from fixture', async () => {
    const { stdout, exitCode } = await evalCode(`
      const vars = figma.getLocalVariables()
      const cols = figma.getLocalVariableCollections()
      return { variables: vars.length, collections: cols.length }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(typeof result.variables).toBe('number')
    expect(typeof result.collections).toBe('number')
  })

  test('switch page', async () => {
    const { stdout, exitCode } = await evalCode(`
      const pages = figma.root.children
      const first = pages[0]
      figma.currentPage = first
      return { page: figma.currentPage.name, pageCount: pages.length }
    `)
    expect(exitCode).toBe(0)
    const result = parseJSON(stdout) as any
    expect(result.page).toBeTruthy()
    expect(result.pageCount).toBeGreaterThanOrEqual(1)
  })
})
