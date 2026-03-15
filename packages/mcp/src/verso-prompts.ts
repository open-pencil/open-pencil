/**
 * Verso-specific MCP prompts with pixel-precise JSX design specs.
 * Shared between server.ts (HTTP) and stdio.ts (stdio transport).
 */

import { z } from 'zod'

type MCPPromptMessage = { role: 'user'; content: { type: 'text'; text: string } }
type MCPPromptResult = { messages: MCPPromptMessage[] }

function userMsg(text: string): MCPPromptResult {
  return { messages: [{ role: 'user', content: { type: 'text', text } }] }
}

// ─── Design Page ──────────────────────────────────────────────────

export const designPagePrompt = {
  name: 'design-page',
  description: 'Create a professional page using pixel-precise JSX specs from the Verso Design Context Engine.',
  params: {
    pageType: z.string().describe('Type of page: landing, dashboard, pricing, settings, etc.'),
    description: z.string().describe('Description of the page to design'),
  },
  handler(args: Record<string, unknown>): MCPPromptResult {
    const pt = (args.pageType as string | undefined) ?? 'landing'
    const desc = (args.description as string | undefined) ?? ''
    return userMsg(`Design a ${pt} page: ${desc}

# VERSO DESIGN CONTEXT — PIXEL-PRECISE JSX SPECS

Follow these EXACT specs for each section. Do NOT improvise dimensions, colors, or spacing.

## GLOBAL RULES
- Page frame: w={1440} h="hug" bg="#0A0A0B" flex="col"
- Max content width: 1200px, centered with px={120}
- Section spacing: py={96} between major sections
- Font: Inter (loaded automatically)
- Colors: bg="#0A0A0B", text="#FFFFFF", muted="#A1A1AA", accent="#6366F1"
- NEVER use a raw colored rectangle as a button — always Frame + Text
- NEVER leave placeholder text — write real, compelling copy
- NEVER skip naming nodes — every Frame and Text needs name=""

## 1. HERO SECTION
\`\`\`jsx
<Frame name="Hero" w="fill" flex="col" items="center" py={96} px={120} gap={24}>
  <Frame name="HeroBadge" h={32} px={16} bg="#6366F122" rounded={16} flex="row" items="center" gap={8}>
    <Ellipse w={8} h={8} bg="#6366F1" />
    <Text name="BadgeText" size={13} weight="medium" color="#6366F1">Now in beta</Text>
  </Frame>
  <Text name="Headline" size={64} weight="bold" color="#FFFFFF" textAlign="center" w={800} lineHeight={72}>
    ${desc || 'Ship faster with AI-powered design'}
  </Text>
  <Text name="Subtext" size={20} color="#A1A1AA" textAlign="center" w={600} lineHeight={32}>
    The only design tool where AI understands design principles, trends, and your brand.
  </Text>
  <Frame name="CTARow" flex="row" gap={16} items="center">
    <Frame name="CTAPrimary" w={200} h={48} bg="#6366F1" rounded={8} flex="row" items="center" justify="center">
      <Text name="CTAText" size={16} weight="semibold" color="#FFFFFF">Get Started Free</Text>
    </Frame>
    <Frame name="CTASecondary" w={160} h={48} bg="#FFFFFF0F" rounded={8} flex="row" items="center" justify="center" stroke="#FFFFFF22" strokeWidth={1}>
      <Text name="CTASecText" size={16} weight="medium" color="#FFFFFF">Watch Demo</Text>
    </Frame>
  </Frame>
  <Text name="SocialProof" size={14} color="#71717A" textAlign="center">Trusted by 2,000+ designers</Text>
</Frame>
\`\`\`

## 2. FEATURES GRID (6 features, 3x2)
\`\`\`jsx
<Frame name="Features" w="fill" flex="col" items="center" py={96} px={120} gap={64}>
  <Frame name="FeaturesHeader" flex="col" items="center" gap={16}>
    <Text name="FeaturesOverline" size={14} weight="semibold" color="#6366F1" textCase="upper" letterSpacing={2}>Features</Text>
    <Text name="FeaturesTitle" size={40} weight="bold" color="#FFFFFF" textAlign="center">Everything you need to design faster</Text>
  </Frame>
  <Frame name="FeaturesGrid" w={1200} flex="row" gap={24} wrap rowGap={24}>
    {/* 6 cards, each w={384} or grow={1} */}
    <Frame name="Feature1" w={384} flex="col" gap={16} p={32} bg="#FFFFFF08" rounded={16} stroke="#FFFFFF0A" strokeWidth={1}>
      <Frame name="FeatureIcon1" w={48} h={48} bg="#6366F122" rounded={12} flex="row" items="center" justify="center">
        <Icon name="lucide:sparkles" size={24} color="#6366F1" />
      </Frame>
      <Text name="FeatureTitle1" size={20} weight="semibold" color="#FFFFFF">Design Context Engine</Text>
      <Text name="FeatureDesc1" size={15} color="#A1A1AA" lineHeight={24} w="fill">4 layers of design intelligence guide every decision.</Text>
    </Frame>
  </Frame>
</Frame>
\`\`\`

## 3. SOCIAL PROOF / TESTIMONIALS (3 cards)
\`\`\`jsx
<Frame name="Testimonials" w="fill" flex="col" items="center" py={96} px={120} gap={48}>
  <Text name="TestimonialsTitle" size={40} weight="bold" color="#FFFFFF" textAlign="center">Loved by designers</Text>
  <Frame name="TestimonialsGrid" w={1200} flex="row" gap={24}>
    <Frame name="Testimonial1" grow={1} flex="col" gap={20} p={32} bg="#FFFFFF08" rounded={16}>
      <Frame name="Stars1" flex="row" gap={4}>
        {Array.from({length:5},(_,i)=><Icon key={i} name="lucide:star" size={16} color="#FBBF24"/>)}
      </Frame>
      <Text name="Quote1" size={16} color="#E4E4E7" lineHeight={26} w="fill" font="Georgia" italic>"This changed how we approach design entirely."</Text>
      <Frame name="Author1" flex="row" gap={12} items="center">
        <Ellipse name="Avatar1" w={40} h={40} bg="#6366F133" />
        <Frame flex="col" gap={2}>
          <Text name="AuthorName1" size={14} weight="semibold" color="#FFFFFF">Sarah Chen</Text>
          <Text name="AuthorRole1" size={13} color="#71717A">Design Lead, Stripe</Text>
        </Frame>
      </Frame>
    </Frame>
  </Frame>
</Frame>
\`\`\`

## 4. CTA FINAL
\`\`\`jsx
<Frame name="FinalCTA" w="fill" flex="col" items="center" py={96} px={120} gap={32} bg="#6366F10D">
  <Text name="CTAHeadline" size={48} weight="bold" color="#FFFFFF" textAlign="center" w={700}>Ready to design 10x faster?</Text>
  <Text name="CTASubtext" size={18} color="#A1A1AA" textAlign="center" w={500}>Join thousands of designers using AI-powered context.</Text>
  <Frame name="CTAFinalBtn" w={240} h={56} bg="#6366F1" rounded={12} flex="row" items="center" justify="center" shadow="0 4 24 #6366F166">
    <Text name="CTAFinalText" size={18} weight="semibold" color="#FFFFFF">Start for Free</Text>
  </Frame>
</Frame>
\`\`\`

## 5. FOOTER
\`\`\`jsx
<Frame name="Footer" w="fill" flex="col" py={64} px={120} gap={48} bg="#050506">
  <Frame name="FooterGrid" w={1200} flex="row" gap={64}>
    <Frame name="FooterBrand" w={300} flex="col" gap={16}>
      <Text name="FooterLogo" size={24} weight="bold" color="#FFFFFF">Verso</Text>
      <Text name="FooterTagline" size={14} color="#71717A" lineHeight={22} w="fill">AI-first design editor with a 4-layer Design Context Engine.</Text>
    </Frame>
    <Frame name="FooterCol1" grow={1} flex="col" gap={12}>
      <Text size={13} weight="semibold" color="#A1A1AA" textCase="upper" letterSpacing={1}>Product</Text>
      <Text size={14} color="#71717A">Features</Text>
      <Text size={14} color="#71717A">Pricing</Text>
      <Text size={14} color="#71717A">Changelog</Text>
    </Frame>
    <Frame name="FooterCol2" grow={1} flex="col" gap={12}>
      <Text size={13} weight="semibold" color="#A1A1AA" textCase="upper" letterSpacing={1}>Resources</Text>
      <Text size={14} color="#71717A">Documentation</Text>
      <Text size={14} color="#71717A">MCP Tools</Text>
    </Frame>
    <Frame name="FooterCol3" grow={1} flex="col" gap={12}>
      <Text size={13} weight="semibold" color="#A1A1AA" textCase="upper" letterSpacing={1}>Company</Text>
      <Text size={14} color="#71717A">GitHub</Text>
      <Text size={14} color="#71717A">Discord</Text>
    </Frame>
  </Frame>
  <Rectangle name="FooterDivider" w="fill" h={1} bg="#FFFFFF0F" />
  <Text name="Copyright" size={13} color="#52525B" textAlign="center">© 2026 Verso. MIT License.</Text>
</Frame>
\`\`\`

## WORKFLOW
1. calc — batch all dimensions
2. Skeleton render — page h="hug" + 5 sections as gray placeholders
3. describe depth=2 — verify skeleton
4. Replace each section with the JSX above using replace_id
5. describe + batch_update after every 2 sections
6. stock_photo — batch avatars/images
7. Final describe + fixes

CRITICAL: Use EXACTLY these specs. Do not change dimensions, colors, or spacing.`)
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
    return userMsg(`Create a design system for "${bn}" with primary color ${pc} (style: ${st}).

Steps:
1. Create color variables (primary, secondary, bg, surface, text, success, warning, error)
2. Create spacing variables (xs=4, sm=8, md=16, lg=24, xl=32)
3. Create components: Button (primary/secondary), Input, Card, Badge
4. Apply consistent spacing and colors via variables`)
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

Steps:
1. Call validate_design to find issues
2. Call get_design_context for improvement guidelines
3. Fix each issue (spacing, contrast, alignment, touch targets)
4. Re-validate to confirm improvements`)
  },
}
