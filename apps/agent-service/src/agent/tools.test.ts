import { describe, it, expect } from 'vitest'
import { MockSandboxProvider } from '../sandbox'
import { createToolSet, MockBrowserTool, svgPreviewDataUrl } from './tools'

describe('svgPreviewDataUrl', () => {
  it('encodes an svg data url that reflects the page heading', () => {
    const url = svgPreviewDataUrl('<html><h1>Hello Forge</h1></html>', 'fallback')
    expect(url).toMatch(/^data:image\/svg\+xml;base64,/)
    const svg = Buffer.from(url.split(',')[1] ?? '', 'base64').toString('utf8')
    expect(svg).toContain('Hello Forge')
  })
})

describe('MockBrowserTool', () => {
  it('returns a data-url screenshot', async () => {
    const shot = await new MockBrowserTool().screenshot('<h1>Hi</h1>', 'page')
    expect(shot.label).toBe('page')
    expect(shot.image).toMatch(/^data:image\//)
  })
})

describe('createToolSet', () => {
  it('scopes fs and terminal to the given sandbox', async () => {
    const provider = new MockSandboxProvider()
    const sandbox = await provider.create({ template: 'node', envAllowlist: [] })
    const tools = createToolSet(provider, sandbox.id, new MockBrowserTool())

    await tools.fs.write('a.txt', 'hello')
    expect(await tools.fs.read('a.txt')).toBe('hello')
    expect((await tools.terminal.exec('echo hi')).stdout).toBe('hi\n')
    expect(await provider.readFile(sandbox.id, 'a.txt')).toBe('hello')
  })
})
