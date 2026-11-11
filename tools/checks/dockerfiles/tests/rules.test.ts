import { expect, test } from 'bun:test'

import { dockerfileFindings, rustToolchainArgument } from '#dockerfiles/rules'

const DIGEST = `sha256:${'a'.repeat(64)}`

function dockerfile(...lines: string[]): string {
  return ['# syntax=docker/dockerfile:1', '# What the image is for.', ...lines, ''].join('\n')
}

test('accepts a Dockerfile that follows the rules', () => {
  const text = dockerfile(
    `FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@${DIGEST} AS bun`,
    `FROM mcr.microsoft.com/playwright:v1.63.0-noble@${DIGEST} AS build`,
    'COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun',
    // A later stage built on an earlier one names it, not an image.
    'FROM build',
    'FROM scratch'
  )
  expect(dockerfileFindings(text)).toEqual([])
})

test('asks for the syntax directive and the comment under it', () => {
  expect(dockerfileFindings(`FROM ubuntu:22.04@${DIGEST}\n`)).toEqual([
    { line: 1, message: expect.stringContaining('# syntax=docker/dockerfile:1') },
    { line: 1, message: expect.stringContaining('say what the image is for') }
  ])
  const uncommented = ['# syntax=docker/dockerfile:1', `FROM ubuntu:22.04@${DIGEST}`, ''].join('\n')
  expect(dockerfileFindings(uncommented)).toEqual([
    { line: 2, message: expect.stringContaining('say what the image is for') }
  ])
})

test('asks for every base image by tag and digest', () => {
  const text = dockerfile(
    'FROM node:22-bookworm-slim',
    `FROM ubuntu@${DIGEST}`,
    'FROM --platform=$BUILDPLATFORM mcr.microsoft.com/playwright:v1.63.0-noble AS build',
    // A stage name that shadows an image still needs pinning before the stage exists.
    'FROM build'
  )
  expect(dockerfileFindings(text)).toEqual([
    { line: 3, message: expect.stringContaining('pin node:22-bookworm-slim') },
    { line: 4, message: expect.stringContaining(`pin ubuntu@${DIGEST}`) },
    { line: 5, message: expect.stringContaining('pin mcr.microsoft.com/playwright:v1.63.0-noble') }
  ])
})

test('reads the Rust toolchain an image installs', () => {
  expect(rustToolchainArgument(dockerfile('ARG RUST_TOOLCHAIN=1.98.1'))).toEqual({
    line: 3,
    value: '1.98.1'
  })
  expect(rustToolchainArgument(dockerfile('ARG DEBIAN_FRONTEND=noninteractive'))).toBeNull()
})
