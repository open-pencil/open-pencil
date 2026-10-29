import { expect, test } from 'bun:test'

import { newestRelease, releaseVersion } from '#mermaid-sources/releases'

test('reads only mermaid@x.y.z tags as releases', () => {
  expect(releaseVersion('mermaid@12.2.0')).toEqual([12, 2, 0])
  expect(releaseVersion('@mermaid-js/parser@2.0.1')).toBeNull()
  expect(releaseVersion('mermaid@12.3.0-rc.1')).toBeNull()
})

test('picks the newest release and the commit an annotated tag points at', () => {
  const lsRemote = [
    'a1\trefs/tags/mermaid@11.17.2',
    'b1\trefs/tags/mermaid@12.10.0',
    'b2\trefs/tags/mermaid@12.10.0^{}',
    'c1\trefs/tags/mermaid@12.9.3',
    'd1\trefs/tags/mermaid@13.0.0-rc.1'
  ].join('\n')
  expect(newestRelease(lsRemote)).toEqual({ tag: 'mermaid@12.10.0', commit: 'b2' })
  expect(newestRelease('p\trefs/tags/@mermaid-js/parser@2.0.1')).toBeNull()
})
