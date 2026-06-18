/**
 * Forge skills: named bundles of expert guidance the coding agent loads on demand to do a
 * specialized job well (SEO, mobile, accessibility, performance, security). A skill is just a
 * directive (an expert checklist) injected into the agent's working context when invoked, so
 * it stays provider-agnostic and configurable. Add a skill by adding an entry to FORGE_SKILLS.
 */

export interface ForgeSkill {
  /** Stable id used to invoke the skill, e.g. "seo-optimize". */
  name: string
  /** Human label shown in menus. */
  label: string
  /** One line on when to use it. */
  description: string
  /** The expert checklist applied to the current workspace when the skill runs. */
  directive: string
}

function lines(...l: string[]): string {
  return l.join('\n')
}

export const FORGE_SKILLS: ForgeSkill[] = [
  {
    name: 'seo-optimize',
    label: 'SEO optimizer',
    description: 'Make a site or page rank and share well on search and social.',
    directive: lines(
      'Optimize the current site for search and social sharing. Work through this checklist and apply whatever is missing:',
      '- Give every page a unique title tag (about 50 to 60 characters) and a meta description (about 150 to 160 characters) that reads naturally.',
      '- Use semantic HTML: exactly one h1 per page, then h2 and h3 in logical order, no skipped levels.',
      '- Add Open Graph and Twitter Card tags (og:title, og:description, og:image, og:url, twitter:card) so shared links preview well.',
      '- Add a canonical link tag on each page. Use short, descriptive, hyphenated URLs.',
      '- Give every image meaningful alt text and a descriptive file name. Set width and height so the layout does not shift.',
      '- Add a robots.txt and a sitemap.xml. Set meta robots only where a page should not be indexed.',
      '- Add JSON-LD structured data (schema.org) matching the page type (Organization, Article, Product, LocalBusiness, FAQ, and so on).',
      '- Make sure the viewport meta tag is present and the page is mobile friendly, since search engines index mobile first.',
      '- Improve Core Web Vitals: lazy-load below-the-fold images, preconnect to critical origins, avoid layout shift, keep the main bundle small.',
      '- Add internal links with descriptive anchor text. Write for humans and never stuff keywords.',
      'After changes, verify the rendered pages and confirm the tags are actually present.',
    ),
  },
  {
    name: 'mobile-optimize',
    label: 'Mobile optimizer',
    description: 'Make a site or app work great on phones.',
    directive: lines(
      'Make the current project work great on phones. Work through this checklist and fix whatever is missing:',
      '- Ensure the viewport meta tag is set to width=device-width, initial-scale=1.',
      '- Use a mobile-first responsive layout: fluid containers (flex or grid), relative units (rem, %, vw), and no fixed pixel widths that overflow.',
      '- Remove horizontal scrolling. Verify the layout at 360 to 414 px wide.',
      '- Make body text at least 16 px so it is readable without zooming.',
      '- Make tap targets at least 44 by 44 px with enough spacing so they are easy to hit.',
      '- Use responsive images (srcset and sizes) and compress assets so they load on a mobile network.',
      '- Replace hover-only interactions with something that works on touch.',
      '- Respect safe-area insets for notches, and make sure sticky headers or bars do not cover content.',
      '- Keep it fast on mobile: lazy-load, split code, and defer non-critical scripts.',
      'After changes, take a screenshot at a phone width and confirm the layout looks right.',
    ),
  },
  {
    name: 'a11y-audit',
    label: 'Accessibility check',
    description: 'Make the UI usable for everyone, including keyboard and screen-reader users.',
    directive: lines(
      'Make the current UI accessible. Work through this checklist and fix whatever is missing:',
      '- Every image has alt text (use empty alt for purely decorative images).',
      '- Every form input has an associated label. Errors are announced, not shown by color alone.',
      '- Text meets WCAG AA color contrast (at least 4.5 to 1 for normal text).',
      '- Everything works with the keyboard alone, in a logical tab order, with a visible focus state.',
      '- Use semantic elements (button, a, nav, main, header, footer) instead of div with a click handler.',
      '- Use ARIA only where needed and correctly. Provide landmark regions and accessible names for controls.',
      '- Headings are in order, the page has a descriptive title, and the html tag has a lang attribute.',
      'After changes, walk the page by keyboard and confirm every control is reachable and named.',
    ),
  },
  {
    name: 'perf-optimize',
    label: 'Performance optimizer',
    description: 'Make pages load and respond faster.',
    directive: lines(
      'Make the current project faster. Measure first, then work through this checklist:',
      '- Lazy-load images and below-the-fold content, and set width and height to avoid layout shift.',
      '- Code-split, defer non-critical JavaScript, and remove unused dependencies.',
      '- Use modern image formats (webp or avif), compress assets, and set long cache headers on static files.',
      '- Preconnect or preload critical resources, and minimize render-blocking CSS.',
      '- Avoid large layout shifts and long main-thread tasks.',
      '- On the server, cache responses, paginate large lists, and index the columns queries filter on.',
      'After changes, re-measure (Lighthouse or web vitals) and confirm the numbers improved.',
    ),
  },
  {
    name: 'security-harden',
    label: 'Security hardening',
    description: 'Close common web security holes before shipping.',
    directive: lines(
      'Harden the current project against common web vulnerabilities. Work through this checklist:',
      '- Validate and sanitize all user input, and escape output so it cannot inject markup or scripts.',
      '- Parameterize every database query. Never build SQL by string concatenation.',
      '- Keep secrets server-side in environment variables. Never ship API keys or service credentials to the client.',
      '- Enforce authorization on every protected route, and scope every query to the current tenant or user.',
      '- Set security headers (Content-Security-Policy, HSTS, X-Content-Type-Options, and similar).',
      '- Hash passwords with bcrypt, scrypt, or argon2. Use secure, httpOnly, sameSite cookies for sessions.',
      '- Rate-limit auth and write endpoints, and verify the signature on any inbound webhook.',
      '- Keep dependencies up to date and remove any with known vulnerabilities.',
      'After changes, re-check each item and confirm nothing sensitive is exposed to the client.',
    ),
  },
]

export function listSkills(): ForgeSkill[] {
  return FORGE_SKILLS
}

/** Look up a skill by its name or its label, case-insensitively. */
export function getSkill(name: string): ForgeSkill | undefined {
  const key = name.trim().toLowerCase()
  return FORGE_SKILLS.find((s) => s.name === key || s.label.toLowerCase() === key)
}
