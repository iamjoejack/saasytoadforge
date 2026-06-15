'use client'

import { useIde } from '@/lib/store'

interface BlockItem {
  id: string
  name: string
  category: string
  description: string
  snippet: string
}

const BLOCKS: BlockItem[] = [
  {
    id: 'hero',
    name: 'Steampunk Hero Panel',
    category: 'Containers',
    description: 'A headline banner with a serif Cinzel title, glowing copper text, and gear accent line.',
    snippet: `{/* Steampunk Hero Panel */}
<div className="relative overflow-hidden rounded-2xl border border-[var(--brass)]/20 bg-black/40 p-8 text-center shadow-xl">
  <div className="circuit-grid opacity-10" />
  <h1 className="font-cinzel text-3xl font-bold tracking-wider text-white">
    TOADFORGE ENGINE
  </h1>
  <p className="mx-auto mt-2 max-w-md text-xs uppercase tracking-widest text-[var(--brass)]">
    Visual-Code Hybrid Workbench
  </p>
  <div className="my-4 mx-auto h-[1px] w-24 bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent" />
  <p className="text-sm text-zinc-400">
    Powering agentic developers with hardware-isolated sandbox runtimes.
  </p>
</div>`,
  },
  {
    id: 'rivet-card',
    name: 'Riveted Glass Card',
    category: 'Containers',
    description: 'A premium container decorated with metallic corner rivets and double borders.',
    snippet: `{/* Riveted Glass Card */}
<div className="relative rounded-xl border border-double border-white/10 bg-white/[0.02] p-6 shadow-lg">
  {/* Rivet Accents */}
  <span className="absolute top-1.5 left-1.5 h-1 w-1 rounded-full bg-zinc-600 ring-1 ring-black/40" />
  <span className="absolute top-1.5 right-1.5 h-1 w-1 rounded-full bg-zinc-600 ring-1 ring-black/40" />
  <span className="absolute bottom-1.5 left-1.5 h-1 w-1 rounded-full bg-zinc-600 ring-1 ring-black/40" />
  <span className="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-zinc-600 ring-1 ring-black/40" />
  
  <h3 className="font-cinzel text-sm font-bold text-zinc-200">System Parameters</h3>
  <p className="mt-2 text-xs text-zinc-500">
    Modify credentials, sandbox timeout scales, and network ports.
  </p>
</div>`,
  },
  {
    id: 'brass-btn',
    name: 'Metallic Brass Button',
    category: 'Inputs',
    description: 'An interactive button styled with radial golden sheen and active-click scale reactions.',
    snippet: `{/* Metallic Brass Button */}
<button 
  type="button" 
  className="rounded border border-[var(--brass)] bg-gradient-to-b from-[#cfa23e] to-[#997a2d] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black shadow-md shadow-[var(--brass)]/10 hover:brightness-110 active:scale-95 transition cursor-pointer"
>
  Activate Chrono-Core
</button>`,
  },
  {
    id: 'gear-widget',
    name: 'Animated Gear Gauge',
    category: 'Widgets',
    description: 'A micro-animated spinner consisting of dual interlocking gears in CSS.',
    snippet: `{/* Animated Gear Gauge */}
<div className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
  <div className="relative h-8 w-8 shrink-0 flex items-center justify-center">
    {/* Large spinning gear */}
    <svg className="h-7 w-7 animate-spin text-[var(--brass)]" style={{ animationDuration: '6s' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  </div>
  <div className="text-[11px]">
    <span className="font-semibold text-zinc-300 block uppercase tracking-wider">Synchronizing</span>
    <span className="text-zinc-500 font-mono">Status: Dialing E2B VM...</span>
  </div>
</div>`,
  },
  {
    id: 'gauge',
    name: 'Copper Utilization Dial',
    category: 'Widgets',
    description: 'A circular utilization scale with dynamic copper-gradient indicator bars.',
    snippet: `{/* Copper Utilization Dial */}
<div className="rounded-xl border border-white/5 bg-white/[0.01] p-4 text-center">
  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 border-dashed border-[var(--brass)]/30">
    <div className="text-xl font-bold font-mono text-[var(--brass)] animate-pulse">84%</div>
  </div>
  <span className="mt-3 block text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
    Tension Load (PSI)
  </span>
</div>`,
  },
  {
    id: 'login-form',
    name: 'Supabase Glass Login',
    category: 'Components',
    description: 'A form overlay with glowing border lines for email authentication.',
    snippet: `{/* Supabase Glass Login */}
<div className="max-w-sm rounded-2xl border border-white/10 bg-[#0d0d0f]/60 p-6 shadow-2xl backdrop-blur-md">
  <h2 className="font-cinzel text-lg font-bold text-zinc-200">Authenticate</h2>
  <p className="text-[11px] text-zinc-500">Sign in to access your dashboard workbench.</p>
  
  <form className="mt-4 space-y-3">
    <input 
      type="email" 
      placeholder="Email address"
      className="w-full rounded bg-black/40 border border-white/5 px-3 py-2 text-xs font-mono text-zinc-300 focus:border-[var(--brass)]/50 focus:outline-none" 
    />
    <input 
      type="password" 
      placeholder="Password"
      className="w-full rounded bg-black/40 border border-white/5 px-3 py-2 text-xs font-mono text-zinc-300 focus:border-[var(--brass)]/50 focus:outline-none" 
    />
    <button 
      type="button" 
      className="w-full rounded bg-[var(--brass)] py-2 text-center text-xs font-bold text-black hover:brightness-110 active:scale-98 transition cursor-pointer"
    >
      Sign In
    </button>
  </form>
</div>`,
  },
]

export function BlocksPalette() {
  const insertSnippet = useIde((s) => s.insertSnippet)
  const activePath = useIde((s) => s.activePath)

  return (
    <div className="flex h-full flex-col bg-[#0c0c0e]">
      <div className="border-b border-white/5 px-3 py-2">
        <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
          Steampunk Blocks Palette
        </h3>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Select a template block to inject it at the cursor position.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3 space-y-3">
        {activePath ? (
          BLOCKS.map((block) => (
            <div
              key={block.id}
              onClick={() => insertSnippet(block.snippet)}
              className="group rounded-lg border border-white/5 bg-white/[0.01] p-3 hover:border-[var(--brass)]/30 hover:bg-[var(--brass)]/[0.02] cursor-pointer transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--brass)] uppercase tracking-wider">
                    {block.category}
                  </span>
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--brass)] transition font-bold">
                    + Insert
                  </span>
                </div>
                <h4 className="text-xs font-bold text-zinc-200 mt-1">{block.name}</h4>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  {block.description}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center text-center p-4 text-xs text-zinc-600">
            Open a code file in the editor to use the blocks palette.
          </div>
        )}
      </div>
    </div>
  )
}
