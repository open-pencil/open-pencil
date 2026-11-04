import type { Skill } from '@/app/ai/skills/types'

export function skillFixture(overrides: Partial<Skill> = {}): Skill {
  return {
    name: 'grid',
    description: 'Lay out pages on an eight-point grid.',
    instructions: 'Snap every frame to multiples of 8.',
    modelInvocable: true,
    userInvocable: true,
    source: 'agents',
    location: '~/.agents/skills/grid',
    files: [],
    readFile: () => Promise.reject(new Error('No files')),
    warnings: [],
    ...overrides
  }
}
