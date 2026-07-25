'use client'

import { useEffect, useRef } from 'react'
import { shellUrl } from '@/lib/forge-client'
import { useIde } from '@/lib/store'
import '@xterm/xterm/css/xterm.css'

export function TerminalPane({ workspaceId }: { workspaceId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const setTerminal = useIde((s) => s.setTerminal)

  useEffect(() => {
    let disposed = false
    let cleanup: () => void = () => {}

    void (async () => {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      if (disposed || !containerRef.current) return

      const term = new Terminal({
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 13,
        cursorBlink: true,
        theme: { background: '#0a0a0b', foreground: '#d4d4d8', cursor: '#c8a24a' },
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.open(containerRef.current)
      fit.fit()

      const socketUrl = await shellUrl(workspaceId)
      if (disposed) return
      const socket = new WebSocket(socketUrl)
      socket.onmessage = (event) => {
        if (typeof event.data === 'string') term.write(event.data)
      }
      socket.onerror = () => term.write('\r\n[forge] shell connection error\r\n')
      term.onData((data) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(data)
      })

      const onResize = () => fit.fit()
      window.addEventListener('resize', onResize)

      // Hand the IDE chrome a handle on the real session, so Terminal and Run menu actions
      // drive this shell rather than claiming work they never did.
      setTerminal({
        clear: () => term.clear(),
        runCommand: (command) => {
          if (socket.readyState !== WebSocket.OPEN) {
            term.write(`\r\n[forge] shell is not connected, could not run: ${command}\r\n`)
            return
          }
          socket.send(`${command}\r`)
        },
      })

      cleanup = () => {
        window.removeEventListener('resize', onResize)
        setTerminal(null)
        socket.close()
        term.dispose()
      }
    })()

    return () => {
      disposed = true
      cleanup()
    }
  }, [workspaceId, setTerminal])

  return (
    <div className="flex h-full flex-col bg-[#0a0a0b]">
      <div className="border-b border-white/5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Terminal
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden px-2 py-1" />
    </div>
  )
}
