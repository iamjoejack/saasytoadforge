import type { ExecResult, FileEntry, SandboxProvider } from '@forge/shared'

/**
 * The scoped tool surface the agent is allowed to use (mission section 10):
 * filesystem + terminal bound to the active sandbox, and a browser for verification
 * screenshots. No host filesystem, no control-plane network, no secret access.
 */
export interface FsTool {
  read(path: string): Promise<string>
  write(path: string, contents: string): Promise<void>
  list(dir: string): Promise<FileEntry[]>
}

export interface TerminalTool {
  exec(cmd: string): Promise<ExecResult>
}

export interface BrowserTool {
  /** Renders HTML headlessly and returns a screenshot as a data URL. */
  screenshot(html: string, label: string): Promise<{ label: string; image: string }>
  readonly kind: 'mock' | 'playwright'
}

export interface ToolSet {
  fs: FsTool
  terminal: TerminalTool
  browser: BrowserTool
}

export function createToolSet(
  provider: SandboxProvider,
  sandboxId: string,
  browser: BrowserTool,
): ToolSet {
  return {
    fs: {
      read: (path) => provider.readFile(sandboxId, path),
      write: (path, contents) => provider.writeFile(sandboxId, path, contents),
      list: (dir) => provider.listFiles(sandboxId, dir),
    },
    terminal: { exec: (cmd) => provider.exec(sandboxId, cmd) },
    browser,
  }
}

// ---- Browser tool implementations ----

function tagText(html: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(html)
  return (match?.[1] ?? '').replace(/<[^>]+>/g, '').trim()
}

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c,
  )
}

/** A lightweight SVG stand-in used by tests and as a fallback when no browser is available. */
export function svgPreviewDataUrl(html: string, label: string): string {
  const heading = tagText(html, 'h1') || tagText(html, 'title') || label
  const title = tagText(html, 'title') || label
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="#0a0a0b"/>
  <rect x="40" y="40" width="720" height="420" rx="10" fill="#141416" stroke="#2a2d31"/>
  <rect x="40" y="40" width="720" height="40" rx="10" fill="#1c1d20"/>
  <circle cx="64" cy="60" r="6" fill="#b56a3a"/><circle cx="84" cy="60" r="6" fill="#c8a24a"/><circle cx="104" cy="60" r="6" fill="#557a4a"/>
  <text x="400" y="220" fill="#ededed" font-family="sans-serif" font-size="34" font-weight="700" text-anchor="middle">${escapeXml(heading)}</text>
  <text x="400" y="262" fill="#8a8f98" font-family="sans-serif" font-size="16" text-anchor="middle">${escapeXml(title)}</text>
  <text x="400" y="432" fill="#5a5f68" font-family="sans-serif" font-size="12" text-anchor="middle">preview (simulated) - real screenshot on E2B</text>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

export class MockBrowserTool implements BrowserTool {
  readonly kind = 'mock' as const
  async screenshot(html: string, label: string): Promise<{ label: string; image: string }> {
    return { label, image: svgPreviewDataUrl(html, label) }
  }
}

/**
 * Renders produced HTML in headless Chromium and captures a real PNG. Falls back to the
 * SVG preview if a browser can't launch, so the loop never breaks.
 */
export class PlaywrightBrowserTool implements BrowserTool {
  readonly kind = 'playwright' as const
  async screenshot(html: string, label: string): Promise<{ label: string; image: string }> {
    try {
      const { chromium } = await import('@playwright/test')
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage({ viewport: { width: 800, height: 500 } })
        await page.setContent(html, { waitUntil: 'load' })
        const buffer = await page.screenshot({ type: 'png' })
        return { label, image: `data:image/png;base64,${buffer.toString('base64')}` }
      } finally {
        await browser.close()
      }
    } catch {
      return new MockBrowserTool().screenshot(html, label)
    }
  }
}
