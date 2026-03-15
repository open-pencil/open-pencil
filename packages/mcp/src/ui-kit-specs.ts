/**
 * UI Kit JSX Specs — pixel-precise component templates for the AI render tool.
 * Each component is a ready-to-use JSX snippet with exact dimensions, colors, and spacing.
 *
 * Used by:
 * - get_design_prompt MCP tool (returns specs for specific components)
 * - design-page prompt (injects all specs into the workflow)
 */

export interface ComponentSpec {
  name: string
  description: string
  jsx: string
  variants?: Record<string, string>
}

export const UI_KIT_SPECS: Record<string, ComponentSpec> = {
  'button-primary': {
    name: 'Button / Primary',
    description: 'Primary CTA button with solid fill. Use for the main action on the page.',
    jsx: `<Frame name="BtnPrimary" h={44} px={24} bg="#6366F1" rounded={8} flex="row" items="center" justify="center" gap={8}>
  <Text name="BtnLabel" size={15} weight="semibold" color="#FFFFFF">Get Started</Text>
</Frame>`,
    variants: {
      large: `<Frame name="BtnPrimaryLg" h={52} px={32} bg="#6366F1" rounded={10} flex="row" items="center" justify="center" gap={8}>
  <Text name="BtnLabel" size={16} weight="semibold" color="#FFFFFF">Get Started Free</Text>
</Frame>`,
      small: `<Frame name="BtnPrimarySm" h={36} px={16} bg="#6366F1" rounded={6} flex="row" items="center" justify="center">
  <Text name="BtnLabel" size={13} weight="semibold" color="#FFFFFF">Submit</Text>
</Frame>`,
      'with-icon': `<Frame name="BtnPrimaryIcon" h={44} px={24} bg="#6366F1" rounded={8} flex="row" items="center" justify="center" gap={8}>
  <Icon name="lucide:arrow-right" size={16} color="#FFFFFF" />
  <Text name="BtnLabel" size={15} weight="semibold" color="#FFFFFF">Continue</Text>
</Frame>`,
    },
  },

  'button-secondary': {
    name: 'Button / Secondary',
    description: 'Ghost button with border. Use for secondary actions.',
    jsx: `<Frame name="BtnSecondary" h={44} px={24} bg="#FFFFFF08" rounded={8} flex="row" items="center" justify="center" stroke="#FFFFFF1A" strokeWidth={1}>
  <Text name="BtnLabel" size={15} weight="medium" color="#FFFFFF">Learn More</Text>
</Frame>`,
  },

  'button-ghost': {
    name: 'Button / Ghost',
    description: 'Text-only button with hover state. Use for tertiary actions.',
    jsx: `<Frame name="BtnGhost" h={44} px={16} rounded={8} flex="row" items="center" justify="center" gap={6}>
  <Text name="BtnLabel" size={14} weight="medium" color="#A1A1AA">View all</Text>
  <Icon name="lucide:arrow-right" size={14} color="#A1A1AA" />
</Frame>`,
  },

  'input-text': {
    name: 'Input / Text',
    description: 'Text input field with placeholder. Height 44px, border 1px.',
    jsx: `<Frame name="InputText" w="fill" h={44} px={16} bg="#FFFFFF08" rounded={8} flex="row" items="center" stroke="#FFFFFF14" strokeWidth={1}>
  <Text name="Placeholder" size={14} color="#71717A">Enter your email...</Text>
</Frame>`,
    variants: {
      'with-label': `<Frame name="InputGroup" w="fill" flex="col" gap={6}>
  <Text name="Label" size={13} weight="medium" color="#E4E4E7">Email address</Text>
  <Frame name="InputText" w="fill" h={44} px={16} bg="#FFFFFF08" rounded={8} flex="row" items="center" stroke="#FFFFFF14" strokeWidth={1}>
    <Text name="Placeholder" size={14} color="#71717A">you@company.com</Text>
  </Frame>
</Frame>`,
    },
  },

  card: {
    name: 'Card',
    description: 'Content card with subtle border and padding. Use for feature cards, testimonials, etc.',
    jsx: `<Frame name="Card" w="fill" flex="col" gap={16} p={32} bg="#FFFFFF08" rounded={16} stroke="#FFFFFF0A" strokeWidth={1}>
  {/* Card content goes here */}
</Frame>`,
    variants: {
      feature: `<Frame name="FeatureCard" w={384} flex="col" gap={16} p={32} bg="#FFFFFF08" rounded={16} stroke="#FFFFFF0A" strokeWidth={1}>
  <Frame name="IconWrap" w={48} h={48} bg="#6366F122" rounded={12} flex="row" items="center" justify="center">
    <Icon name="lucide:sparkles" size={24} color="#6366F1" />
  </Frame>
  <Text name="CardTitle" size={20} weight="semibold" color="#FFFFFF">Feature Title</Text>
  <Text name="CardDesc" size={15} color="#A1A1AA" lineHeight={24} w="fill">Feature description that explains the value proposition clearly.</Text>
</Frame>`,
      testimonial: `<Frame name="TestimonialCard" grow={1} flex="col" gap={20} p={32} bg="#FFFFFF08" rounded={16}>
  <Frame name="Stars" flex="row" gap={4}>
    {Array.from({length:5},(_,i)=><Icon key={i} name="lucide:star" size={16} color="#FBBF24"/>)}
  </Frame>
  <Text name="Quote" size={16} color="#E4E4E7" lineHeight={26} w="fill" font="Georgia" italic>"Amazing product that changed how we work."</Text>
  <Frame name="Author" flex="row" gap={12} items="center">
    <Ellipse name="Avatar" w={40} h={40} bg="#6366F133" />
    <Frame flex="col" gap={2}>
      <Text name="Name" size={14} weight="semibold" color="#FFFFFF">Jane Doe</Text>
      <Text name="Role" size={13} color="#71717A">CEO, Acme Inc</Text>
    </Frame>
  </Frame>
</Frame>`,
      stat: `<Frame name="StatCard" grow={1} flex="col" gap={8} p={24} bg="#FFFFFF08" rounded={12} stroke="#FFFFFF0A" strokeWidth={1}>
  <Text name="StatValue" size={36} weight="bold" color="#FFFFFF">99.9%</Text>
  <Text name="StatLabel" size={13} weight="medium" color="#71717A" textCase="upper" letterSpacing={1}>Uptime</Text>
</Frame>`,
    },
  },

  badge: {
    name: 'Badge',
    description: 'Small label badge. Use for status, categories, or "New" indicators.',
    jsx: `<Frame name="Badge" h={24} px={10} bg="#6366F122" rounded={99} flex="row" items="center" gap={6}>
  <Ellipse w={6} h={6} bg="#6366F1" />
  <Text name="BadgeText" size={12} weight="medium" color="#6366F1">New</Text>
</Frame>`,
    variants: {
      success: `<Frame name="BadgeSuccess" h={24} px={10} bg="#16A34A22" rounded={99} flex="row" items="center">
  <Text name="BadgeText" size={12} weight="medium" color="#16A34A">Active</Text>
</Frame>`,
      neutral: `<Frame name="BadgeNeutral" h={24} px={10} bg="#FFFFFF14" rounded={99} flex="row" items="center">
  <Text name="BadgeText" size={12} weight="medium" color="#A1A1AA">Beta</Text>
</Frame>`,
    },
  },

  navbar: {
    name: 'Navigation Bar',
    description: 'Top navigation with logo, links, and CTA. Height 64px.',
    jsx: `<Frame name="NavBar" w="fill" h={64} px={120} flex="row" items="center" justify="between">
  <Frame name="NavLeft" flex="row" items="center" gap={32}>
    <Text name="Logo" size={20} weight="bold" color="#FFFFFF">Brand</Text>
    <Frame name="NavLinks" flex="row" gap={24} items="center">
      <Text size={14} weight="medium" color="#A1A1AA">Features</Text>
      <Text size={14} weight="medium" color="#A1A1AA">Pricing</Text>
      <Text size={14} weight="medium" color="#A1A1AA">Docs</Text>
    </Frame>
  </Frame>
  <Frame name="NavRight" flex="row" gap={12} items="center">
    <Text size={14} weight="medium" color="#A1A1AA">Log in</Text>
    <Frame name="NavCTA" h={36} px={16} bg="#6366F1" rounded={8} flex="row" items="center">
      <Text size={14} weight="semibold" color="#FFFFFF">Get Started</Text>
    </Frame>
  </Frame>
</Frame>`,
  },

  'section-header': {
    name: 'Section Header',
    description: 'Section intro with overline badge, title, and subtitle. Centered.',
    jsx: `<Frame name="SectionHeader" flex="col" items="center" gap={16}>
  <Frame name="Overline" h={28} px={12} bg="#6366F122" rounded={99} flex="row" items="center">
    <Text size={12} weight="semibold" color="#6366F1" textCase="upper" letterSpacing={1}>Features</Text>
  </Frame>
  <Text name="SectionTitle" size={40} weight="bold" color="#FFFFFF" textAlign="center" w={700}>Everything you need</Text>
  <Text name="SectionSubtitle" size={18} color="#A1A1AA" textAlign="center" w={500}>Build faster with tools designed for modern teams.</Text>
</Frame>`,
  },

  'footer-minimal': {
    name: 'Footer / Minimal',
    description: 'Simple footer with brand, link columns, and copyright.',
    jsx: `<Frame name="Footer" w="fill" flex="col" py={64} px={120} gap={48} bg="#050506">
  <Frame name="FooterGrid" w="fill" flex="row" gap={64}>
    <Frame name="Brand" w={280} flex="col" gap={12}>
      <Text size={20} weight="bold" color="#FFFFFF">Brand</Text>
      <Text size={14} color="#52525B" lineHeight={22} w="fill">Short description of the product.</Text>
    </Frame>
    <Frame grow={1} flex="col" gap={10}>
      <Text size={13} weight="semibold" color="#71717A" textCase="upper" letterSpacing={1}>Product</Text>
      <Text size={14} color="#A1A1AA">Features</Text>
      <Text size={14} color="#A1A1AA">Pricing</Text>
      <Text size={14} color="#A1A1AA">Changelog</Text>
    </Frame>
    <Frame grow={1} flex="col" gap={10}>
      <Text size={13} weight="semibold" color="#71717A" textCase="upper" letterSpacing={1}>Company</Text>
      <Text size={14} color="#A1A1AA">About</Text>
      <Text size={14} color="#A1A1AA">Blog</Text>
      <Text size={14} color="#A1A1AA">Contact</Text>
    </Frame>
  </Frame>
  <Rectangle w="fill" h={1} bg="#FFFFFF0A" />
  <Text size={13} color="#3F3F46" textAlign="center">© 2026 Brand. All rights reserved.</Text>
</Frame>`,
  },

  'hero-section': {
    name: 'Hero Section',
    description: 'Full-width hero with headline, subtext, CTAs, and social proof.',
    jsx: `<Frame name="Hero" w="fill" flex="col" items="center" py={96} px={120} gap={32}>
  <Frame name="HeroBadge" h={28} px={12} bg="#6366F122" rounded={99} flex="row" items="center" gap={6}>
    <Ellipse w={6} h={6} bg="#6366F1" />
    <Text size={12} weight="medium" color="#6366F1">Now in beta</Text>
  </Frame>
  <Text name="Headline" size={64} weight="bold" color="#FFFFFF" textAlign="center" w={800} lineHeight={72}>Ship faster with AI-powered design</Text>
  <Text name="Subtext" size={20} color="#A1A1AA" textAlign="center" w={560} lineHeight={30}>The only design tool where AI understands your brand, your users, and design principles.</Text>
  <Frame name="CTARow" flex="row" gap={12} items="center">
    <Frame name="CTAPrimary" h={48} px={28} bg="#6366F1" rounded={10} flex="row" items="center" justify="center">
      <Text size={16} weight="semibold" color="#FFFFFF">Get Started Free</Text>
    </Frame>
    <Frame name="CTASecondary" h={48} px={24} bg="#FFFFFF08" rounded={10} flex="row" items="center" justify="center" stroke="#FFFFFF1A" strokeWidth={1}>
      <Text size={16} weight="medium" color="#FFFFFF">Watch Demo</Text>
    </Frame>
  </Frame>
  <Text name="SocialProof" size={14} color="#52525B">Trusted by 2,000+ designers and developers</Text>
</Frame>`,
  },

  'cta-section': {
    name: 'CTA Section',
    description: 'Final call-to-action section with headline and button.',
    jsx: `<Frame name="CTASection" w="fill" flex="col" items="center" py={96} px={120} gap={32} bg="#6366F10A">
  <Text name="CTATitle" size={44} weight="bold" color="#FFFFFF" textAlign="center" w={600}>Ready to build something amazing?</Text>
  <Text name="CTASubtext" size={18} color="#A1A1AA" textAlign="center" w={440}>Join thousands of teams shipping faster.</Text>
  <Frame name="CTABtn" h={52} px={32} bg="#6366F1" rounded={12} flex="row" items="center" justify="center" shadow="0 4 24 #6366F144">
    <Text size={17} weight="semibold" color="#FFFFFF">Start for Free</Text>
  </Frame>
</Frame>`,
  },
}

/** Get all component names */
export function getComponentNames(): string[] {
  return Object.keys(UI_KIT_SPECS)
}

/** Get a specific component spec */
export function getComponentSpec(name: string): ComponentSpec | null {
  return UI_KIT_SPECS[name] ?? null
}

/** Get all specs as a formatted prompt string */
export function getAllSpecsAsPrompt(): string {
  const lines: string[] = ['# UI Kit Component Specs\n']

  for (const [key, spec] of Object.entries(UI_KIT_SPECS)) {
    lines.push(`## ${spec.name} (\`${key}\`)`)
    lines.push(spec.description)
    lines.push('```jsx')
    lines.push(spec.jsx)
    lines.push('```')

    if (spec.variants) {
      for (const [variantName, variantJsx] of Object.entries(spec.variants)) {
        lines.push(`### Variant: ${variantName}`)
        lines.push('```jsx')
        lines.push(variantJsx)
        lines.push('```')
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
