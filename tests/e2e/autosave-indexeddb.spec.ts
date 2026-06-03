import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { CanvasHelper } from '#tests/helpers/canvas'

const editor = useEditorSetup()

test('IndexedDB autosave writes after scene changes (no file handle required)', async () => {
  test.setTimeout(60_000)
  // 既存 entry を削除 (delete record、DB 自体は touch しない)
  await editor.page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.open('inkly-document-cache', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('documents')) {
          db.close()
          return resolve()
        }
        const tx = db.transaction('documents', 'readwrite')
        const del = tx.objectStore('documents').delete('latest')
        del.onsuccess = () => {
          db.close()
          resolve()
        }
        del.onerror = () => {
          db.close()
          resolve()
        }
      }
      req.onerror = () => resolve()
    })
  })

  // 何か描いて sceneVersion を bump
  await editor.canvas.drawRect(300, 300, 60, 60)

  // sceneVersion が増えたことを確認
  const versionAfterDraw = await editor.page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store not initialized')
    return store.state.sceneVersion
  })
  expect(versionAfterDraw).toBeGreaterThan(0)

  // IndexedDB autosave debounce (1500ms) + write 時間の buffer 待ち
  await editor.page.waitForTimeout(2500)

  // IndexedDB に書き込まれているか確認
  const after = await editor.page.evaluate(async () => {
    return await new Promise<{ name: string; bytesLen: number } | null>((resolve) => {
      const req = indexedDB.open('inkly-document-cache', 1)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('documents', 'readonly')
        const get = tx.objectStore('documents').get('latest')
        get.onsuccess = () => {
          const v = get.result
          db.close()
          if (!v) return resolve(null)
          resolve({ name: v.name, bytesLen: v.bytes?.byteLength ?? 0 })
        }
        get.onerror = () => {
          db.close()
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    })
  })

  expect(after).not.toBeNull()
  expect(after!.bytesLen).toBeGreaterThan(0)
})

test('autosave status indicator transitions saving → saved → idle', async ({ browser }) => {
  test.setTimeout(60_000)
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  })
  const page = await context.newPage()
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  // 描画
  await canvas.drawRect(150, 150, 60, 60)

  // 1500ms debounce のあと saving 表示
  await page.waitForTimeout(1700)

  // status indicator が一瞬でも表示される必要 (saving or saved)
  const indicator = page.locator('[data-test-id="autosave-status"]')
  // saving は瞬間的、saved は 2 秒、いずれかが現れることを expect
  await expect(indicator).toBeVisible({ timeout: 5000 })

  // 最終的に idle に戻って indicator が消える
  await expect(indicator).toBeHidden({ timeout: 10_000 })

  await page.close()
  await context.close()
})

test('reload restores edited document from IndexedDB cache', async ({ browser }) => {
  test.setTimeout(60_000)
  // 新しい context で実行 (state 隔離)
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2
  })
  const page = await context.newPage()
  await page.goto('/')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  // 既存 entry を削除 (delete record)
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.open('inkly-document-cache', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('documents')) {
          db.close()
          return resolve()
        }
        const tx = db.transaction('documents', 'readwrite')
        const del = tx.objectStore('documents').delete('latest')
        del.onsuccess = () => {
          db.close()
          resolve()
        }
        del.onerror = () => {
          db.close()
          resolve()
        }
      }
      req.onerror = () => resolve()
    })
  })

  // 矩形を 1 つ描いて sceneVersion を bump
  await canvas.drawRect(200, 200, 80, 80)

  // 描画後の sceneVersion を記録 + node 数を記録
  const stateBefore = await page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store not initialized')
    const allNodes = store.graph.getAllNodes()
    return {
      sceneVersion: store.state.sceneVersion,
      nodeCount: allNodes.length,
      pageId: store.state.currentPageId
    }
  })
  expect(stateBefore.sceneVersion).toBeGreaterThan(0)

  // autosave 完了を待つ
  await page.waitForTimeout(2500)

  // IndexedDB に保存されたか確認
  const cached = await page.evaluate(async () => {
    return await new Promise<{ bytesLen: number } | null>((resolve) => {
      const req = indexedDB.open('inkly-document-cache', 1)
      req.onsuccess = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('documents')) {
          db.close()
          return resolve(null)
        }
        const tx = db.transaction('documents', 'readonly')
        const get = tx.objectStore('documents').get('latest')
        get.onsuccess = () => {
          const v = get.result
          db.close()
          if (!v) return resolve(null)
          resolve({ bytesLen: v.bytes?.byteLength ?? 0 })
        }
        get.onerror = () => {
          db.close()
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    })
  })
  expect(cached).not.toBeNull()
  expect(cached!.bytesLen).toBeGreaterThan(0)

  // リロードして cache から restore されることを確認
  await page.reload()
  const reloadedCanvas = new CanvasHelper(page)
  await reloadedCanvas.waitForInit()

  // 復元待ち (cache load + open は非同期)
  await page.waitForTimeout(2000)

  // 復元後の node 数を確認
  const stateAfter = await page.evaluate(() => {
    const store = window.inkly?.getStore?.()
    if (!store) throw new Error('Inkly store not initialized')
    return {
      nodeCount: store.graph.getAllNodes().length,
      pageId: store.state.currentPageId
    }
  })

  // node 数が一致するはず (リロード前と同じ rectangle が存在)
  expect(stateAfter.nodeCount).toBe(stateBefore.nodeCount)

  await page.close()
  await context.close()
})
