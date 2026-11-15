import { DockerfileParser } from 'dockerfile-ast'

/**
 * A line of a Dockerfile that breaks the repository's rules beyond hadolint's
 * (`tools/AGENTS.md`, CI); hadolint itself checks how apt is used.
 */
export interface Finding {
  line: number
  message: string
}

const SYNTAX = 'docker/dockerfile:1'
const DIGEST = /^sha256:[0-9a-f]{64}$/

/**
 * Checks that a Dockerfile opens with the `syntax` directive and a comment saying what the image is
 * for, and that every base image names the tag its digest was resolved from.
 */
export function dockerfileFindings(text: string): Finding[] {
  const dockerfile = DockerfileParser.parse(text)
  const findings: Finding[] = []

  const syntax = dockerfile.getDirectives().find((directive) => directive.getName() === 'syntax')
  if (syntax?.getValue() !== SYNTAX) {
    findings.push({ line: 1, message: `start with \`# syntax=${SYNTAX}\`` })
  }
  const header = (syntax?.getRange().start.line ?? -1) + 1
  if (!dockerfile.getComments().some((comment) => comment.getRange().start.line === header)) {
    findings.push({
      line: header + 1,
      message: 'say what the image is for in a comment under the syntax directive'
    })
  }

  const stages = new Set<string>()
  for (const from of dockerfile.getFROMs()) {
    const name = from.getImageName()
    const tag = from.getImageTag()
    const digest = from.getImageDigest()
    const isStage = name !== null && tag === null && digest === null && stages.has(name)
    if (name && name !== 'scratch' && !isStage && !(tag && digest && DIGEST.test(digest))) {
      findings.push({
        line: from.getRange().start.line + 1,
        message: `pin ${from.getImage()} as name:tag@sha256:digest, with the tag it was resolved from`
      })
    }
    const stage = from.getBuildStage()
    if (stage) stages.add(stage)
  }
  return findings
}

/** The `RUST_TOOLCHAIN` an image installs, which must be the channel `rust-toolchain.toml` pins. */
export function rustToolchainArgument(text: string): { line: number; value: string } | null {
  for (const arg of DockerfileParser.parse(text).getARGs()) {
    const property = arg.getProperty()
    const value = property?.getValue()
    if (property?.getName() === 'RUST_TOOLCHAIN' && value) {
      return { line: arg.getRange().start.line + 1, value }
    }
  }
  return null
}
