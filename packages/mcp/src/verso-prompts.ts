/**
 * Verso-specific MCP prompts with 3-pass workflow and UI Kit injection.
 * Shared between server.ts (HTTP) and stdio.ts (stdio transport).
 */

import { z } from 'zod'

import { getAllSpecsAsPrompt } from './ui-kit-specs'

type MCPPromptMessage = { role: 'user'; content: { type: 'text'; text: string } }
type MCPPromptResult = { messages: MCPPromptMessage[] }

function userMsg(text: string): MCPPromptResult {
  return { messages: [{ role: 'user', content: { type: 'text', text } }] }
}

// ─── Design Page (3-pass workflow) ────────────────────────────────

export const designPagePrompt = {
  name: 'design-page',
  description: 'Create a professional page using the Verso 3-pass workflow: skeleton → content → refine. Injects pixel-precise UI Kit component specs.',
  params: {
    pageType: z.string().describe('Type of page: landing, dashboard, pricing, settings, etc.'),
    description: z.string().describe('Description of the page to design'),
  },
  handler(args: Record<string, unknown>): MCPPromptResult {
    const pt = (args.pageType as string | undefined) ?? 'landing'
    const desc = (args.description as string | undefined) ?? ''
    const uiKitSpecs = getAllSpecsAsPrompt()

    return userMsg(`Design a ${pt} page: ${desc}

# VERSO 3-PASS DESIGN WORKFLOW

You MUST follow this exact 3-pass process. Do NOT render everything in one call.

## PASS 1 — SKELETON (structure only, no content)

Create the page frame and ALL section containers as empty gray placeholders.
This establishes the spatial structure before any content.

\`\`\`
calc → dimensions
render → page frame w={1440} h="hug" bg="#0A0A0B" flex="col" with:
  - NavBar placeholder (h={64})
  - Hero placeholder (h={600})
  - Features placeholder (h={500})
  - Social proof placeholder (h={400})
  - CTA placeholder (h={300})
  - Footer placeholder (h={300})
Each placeholder: <Frame name="SectionName" w="fill" h={N} bg="#111113" />
describe depth=2 → verify all sections exist with correct heights
\`\`\`

## PASS 2 — CONTENT (fill each section using UI Kit specs)

Replace each skeleton placeholder with the real content using \`replace_id\`.
Use the EXACT component specs below — do NOT improvise dimensions or colors.

For EACH section:
1. \`render\` with \`replace_id\` pointing to the skeleton frame
2. \`describe\` the new content immediately
3. \`batch_update\` to fix any layout issues
4. Only then move to the next section

## PASS 3 — REFINE (polish and verify)

1. \`describe\` root depth=2 — check ALL sections
2. \`batch_update\` — fix spacing, alignment, overflow issues
3. \`stock_photo\` — batch ALL image placeholders in one call
4. \`validate_design\` — check contrast, spacing grid, touch targets
5. Fix any validation issues
6. Final \`describe\` depth=1

## GLOBAL DESIGN RULES

- Page: w={1440} h="hug" bg="#0A0A0B" flex="col"
- Content max-width: 1200px → use px={120} on sections
- Section vertical padding: py={96}
- Accent: #6366F1 | Text: #FFFFFF | Muted: #A1A1AA | Subtle bg: #FFFFFF08
- Font: Inter (auto-loaded)
- Every multi-child Frame MUST have flex="col" or flex="row"
- Every element MUST have name=""
- NEVER use a raw Rectangle as a button — always Frame + Text
- NEVER use placeholder text — write real, compelling copy for "${desc || 'this product'}"
- Button min touch target: h={44}
- Border radius: buttons=8, cards=16, badges=99
- Card pattern: bg="#FFFFFF08" rounded={16} stroke="#FFFFFF0A" strokeWidth={1}

${uiKitSpecs}

## SECTION ASSEMBLY GUIDE

### NavBar
Use the \`navbar\` component spec. Replace "Brand" with the product name.

### Hero
Use the \`hero-section\` spec. Customize headline and subtext for "${desc || 'the product'}".

### Features (6 cards, 3×2 grid)
Use the \`section-header\` spec for the header.
Use the \`card\` feature variant for each card. Use \`w={384}\` for 3-column with gap={24}.
Icons: lucide:sparkles, lucide:zap, lucide:shield, lucide:code, lucide:layers, lucide:globe

### Social Proof (3 testimonial cards)
Use the \`card\` testimonial variant. Use \`grow={1}\` for equal-width cards.

### CTA
Use the \`cta-section\` spec.

### Footer
Use the \`footer-minimal\` spec.

CRITICAL: Call \`get_design_prompt\` before rendering if you need specific component specs.
Budget: ~15-20 tool calls total (1 calc + 1 skeleton + 6 content renders + 2 describes + 1 stock_photo + fixes).`)
  },
}

// ─── Design System ────────────────────────────────────────────────

export const designSystemPrompt = {
  name: 'design-system',
  description: 'Create a complete design system with variables, components, and consistent tokens.',
  params: {
    brandName: z.string().describe('Brand name'),
    primaryColor: z.string().describe('Primary color hex'),
    style: z.string().optional().describe('Design style: modern, classic, playful, etc.'),
  },
  handler(args: Record<string, unknown>): MCPPromptResult {
    const bn = (args.brandName as string | undefined) ?? 'Brand'
    const pc = (args.primaryColor as string | undefined) ?? '#7B5EA7'
    const st = (args.style as string | undefined) ?? 'modern'
    const uiKitSpecs = getAllSpecsAsPrompt()

    return userMsg(`Create a design system for "${bn}" with primary color ${pc} (style: ${st}).

## Workflow
1. Create color variables: primary=${pc}, secondary, bg=#0A0A0B, surface=#FFFFFF08, text=#FFFFFF, muted=#A1A1AA, success=#16A34A, warning=#EAB308, error=#EF4444
2. Create spacing variables: xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48
3. Create each component below as a named Component (reusable)
4. Use variables for all colors — no hardcoded values

## Component Specs
${uiKitSpecs}

Replace the accent color #6366F1 with ${pc} in all components.`)
  },
}

// ─── Refine Design ────────────────────────────────────────────────

export const refineDesignPrompt = {
  name: 'refine-design',
  description: 'Improve an existing design based on Design Context Engine validation.',
  params: {
    feedback: z.string().describe('What to improve in the design'),
  },
  handler(args: Record<string, unknown>): MCPPromptResult {
    const fb = (args.feedback as string | undefined) ?? ''
    return userMsg(`Refine the current design: ${fb}

## Workflow
1. \`describe\` root depth=2 — understand current state
2. \`validate_design\` — find issues (contrast, spacing, touch targets)
3. \`get_design_prompt\` — get correct component specs
4. \`batch_update\` — fix all issues at once:
   - Spacing: must be multiples of 4 (prefer 8, 16, 24, 32, 48)
   - Touch targets: buttons/inputs min h={44}
   - Contrast: text on dark bg must be #FFFFFF or #A1A1AA, never below #71717A
   - Cards: bg="#FFFFFF08" rounded={16} stroke="#FFFFFF0A" strokeWidth={1}
   - Buttons: always Frame + Text, never raw Rectangle
5. Re-\`describe\` to confirm fixes
6. \`validate_design\` — confirm 0 critical issues`)
  },
}
