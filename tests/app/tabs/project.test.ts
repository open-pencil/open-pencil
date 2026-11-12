import { expect, test } from 'bun:test'

import { createProject, type Project } from '@/app/projects/schema'
import { findProjectTab } from '@/app/tabs/project'

const karbid = createProject({ repository: 'D:/Karbid2' })
const pencil = createProject({ repository: 'D:/OpenPencilDev-src' })
if (karbid === null || pencil === null) throw new Error('the fixtures must make projects')

/** Only what the lookup reads: a tab's kind and the project it shows. */
function tab(kind: string, project?: Project) {
  return { kind, project }
}

test('finds the tab a project already has', () => {
  const projectTab = tab('project', karbid)
  const tabs = [tab('home'), projectTab, tab('project', pencil)]

  expect(findProjectTab(tabs, karbid.id)).toBe(projectTab)
})

test('a project with no tab answers none', () => {
  expect(findProjectTab([tab('home'), tab('project', karbid)], pencil.id)).toBeNull()
})

test('a document tab is never mistaken for a project screen', () => {
  expect(findProjectTab([tab('document'), tab('new-file')], karbid.id)).toBeNull()
})
