import { gateErrors, type JobStatus } from './policy'

const input = process.env.CI_NEEDS
if (!input) throw new Error('Missing CI job results')
// GitHub serializes the needs context. Malformed data or unexpected statuses fail closed.
const needs: Record<string, JobStatus> = JSON.parse(input)
const errors = gateErrors(needs)
for (const error of errors) console.error(error)
if (errors.length > 0) process.exitCode = 1
else console.log('All checks required for this change succeeded')
