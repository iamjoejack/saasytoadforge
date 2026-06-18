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
  {
    name: 'tdd',
    label: 'Test-driven development',
    description: 'Build a feature or fix a bug test-first.',
    directive: lines(
      'Build this in a tight red-green-refactor loop:',
      '- Write a failing test that captures the desired behavior, and run it to watch it fail for the right reason.',
      '- Write the minimum code to make it pass, then run the test and watch it go green.',
      '- Refactor with the test as a safety net, keeping it green.',
      '- Cover edge cases and error paths, not only the happy path.',
      '- Keep tests fast, isolated, and deterministic.',
    ),
  },
  {
    name: 'debug',
    label: 'Systematic debugging',
    description: 'Track down a hard bug methodically instead of guessing.',
    directive: lines(
      'Debug this methodically:',
      '- Reproduce the bug reliably first, and find the smallest input that triggers it.',
      '- Read the actual error and stack trace. Do not guess.',
      '- Form one hypothesis at a time and test it with a log or a check.',
      '- Bisect to narrow where good state becomes bad.',
      '- Fix the root cause, not the symptom.',
      '- Add a regression test that fails before the fix and passes after.',
    ),
  },
  {
    name: 'code-review',
    label: 'Code review',
    description: 'Review changes for correctness, security, and quality.',
    directive: lines(
      'Review the current changes like a careful senior engineer:',
      '- Check correctness first: does it do what it claims, including edge cases and errors?',
      '- Look for security issues: input handling, authorization, secrets, injection.',
      '- Confirm every data access is scoped to the current tenant or user.',
      '- Flag duplication and needless complexity, and prefer the simpler version.',
      '- Verify tests exist and actually cover the change.',
      '- Check that naming, types, and error handling match the surrounding code.',
    ),
  },
  {
    name: 'refactor',
    label: 'Refactor and simplify',
    description: 'Clean up code without changing behavior.',
    directive: lines(
      'Refactor for clarity without changing behavior:',
      '- Make the smallest change that improves clarity, and keep behavior identical.',
      '- Remove dead code, unused variables, and needless indirection.',
      '- Extract well-named functions for repeated or complex logic.',
      '- Prefer clear names over comments that explain confusing code.',
      '- Keep the tests green at every step.',
    ),
  },
  {
    name: 'plan-architecture',
    label: 'Plan the architecture',
    description: 'Design the approach before writing code.',
    directive: lines(
      'Plan before you build:',
      '- Restate the goal and the acceptance criteria in your own words.',
      '- Pick the simplest design that meets them, and avoid speculative generality.',
      '- Decide the data model and the boundaries between modules first.',
      '- Identify the riskiest unknown and address it earliest.',
      '- List the files to create or change before writing code.',
      '- Note what is explicitly out of scope.',
    ),
  },
  {
    name: 'prototype',
    label: 'Prototype first',
    description: 'De-risk a design with a throwaway prototype.',
    directive: lines(
      'Prototype before committing to a design:',
      '- Build the smallest thing that answers the open question, then plan to throw it away.',
      '- Hardcode and fake whatever is not the point.',
      '- Use it to validate the data model, the flow, or the look.',
      '- Once the design is clear, rebuild it properly with tests.',
    ),
  },
  {
    name: 'frontend-design',
    label: 'Frontend design',
    description: 'Design a distinctive, production-grade interface.',
    directive: lines(
      'Design a polished, distinctive interface:',
      '- Build a clear visual hierarchy with one primary action per screen.',
      '- Use consistent spacing, a type scale, and a small color palette.',
      '- Make it responsive and accessible from the start.',
      '- Add real states: loading, empty, error, and success.',
      '- Prefer a considered, branded look over a generic template.',
      '- Verify with a screenshot, not just the DOM.',
    ),
  },
  {
    name: 'write-human-copy',
    label: 'Human copywriting',
    description: 'Write UI and marketing copy that sounds like a real person.',
    directive: lines(
      'Write copy that sounds human, not generated:',
      '- Use plain, direct language a real person would use.',
      '- Use sentence case. Never use em or en dashes.',
      '- Cut filler, hedging, and marketing fluff.',
      '- Be specific and concrete, and lead with the point.',
      '- Read it out loud, and if it sounds like a robot, rewrite it.',
    ),
  },
  {
    name: 'nextjs',
    label: 'Next.js best practices',
    description: 'Build a Next.js app the right way.',
    directive: lines(
      'Follow current Next.js best practices:',
      '- Read the installed version docs before assuming an API, since conventions change between majors.',
      '- Default to Server Components, and add a client boundary only where interactivity needs it.',
      '- Never pass functions or non-serializable values across the server to client boundary.',
      '- Fetch data on the server, and cache and revalidate deliberately.',
      '- Keep secrets server-side. Only public-prefixed env vars reach the client.',
      '- Use the file-based router and layouts as intended.',
    ),
  },
  {
    name: 'supabase',
    label: 'Supabase and Postgres',
    description: 'Use Supabase safely and correctly.',
    directive: lines(
      'Use Supabase and Postgres correctly:',
      '- Turn on Row Level Security on every table, with policies that scope rows to the user or tenant.',
      '- Never put the service role key in client code. Keep it server-side.',
      '- Use the client library and parameterized queries, not string-built SQL.',
      '- Add indexes on the columns you filter and join on.',
      '- Make schema changes additively, and avoid destructive migrations that lose data.',
      '- Use the auth helpers for sessions rather than rolling your own.',
    ),
  },
  {
    name: 'api-design',
    label: 'API design',
    description: 'Design clean, safe HTTP APIs.',
    directive: lines(
      'Design a clean, safe API:',
      '- Use clear resource-oriented routes with the right methods and status codes.',
      '- Validate every input and return helpful, structured errors.',
      '- Authenticate and authorize every endpoint, and scope data to the caller.',
      '- Keep responses consistent, and version the API.',
      '- Paginate lists and never return unbounded result sets.',
      '- Rate-limit sensitive endpoints and document each one.',
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
