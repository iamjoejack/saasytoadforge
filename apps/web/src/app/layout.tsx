import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Cinzel } from 'next/font/google'
import './globals.css'

const cinzel = Cinzel({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SaaSyToad Forge',
  description: 'Agent-first coding workspace. Describe the task, watch it ship.',
}

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('forge:theme');if(t==='slate'){document.body.classList.remove('theme-steampunk');document.body.classList.add('theme-slate');}}catch(e){}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`theme-steampunk ${cinzel.variable} relative min-h-screen overflow-x-hidden`} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        
        {/* Layered Steampunk Workshop Backdrop */}
        <div className="fixed inset-0 z-0 pointer-events-none select-none theme-steampunk-backdrop">
          {/* Layer 0: Video background */}
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/toadtopia-bg.png"
              className="absolute inset-0 w-full h-full object-cover opacity-45 motion-reduce:hidden"
            >
              <source src="/toadtopia-bg.mp4" type="video/mp4" />
            </video>
            <div 
              className="absolute inset-0 bg-cover bg-center bg-no-repeat hidden motion-reduce:block" 
              style={{ backgroundImage: "url('/toadtopia-bg.png')", opacity: 0.45 }} 
            />
          </div>
          {/* Layer 1: Ambient gaslight radial gradient */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_120%_at_50%_0%,_oklch(0.82_0.15_70_/_0.15)_0%,_var(--background)_80%)]" />
          
          {/* Layer 2: Verdigris/patina radial gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_oklch(0.55_0.1_150_/_0.15)_0%,_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_oklch(0.65_0.16_75_/_0.08)_0%,_transparent_70%)]" />
          
          {/* Layer 3: Blueprint grid */}
          <div className="absolute inset-0 circuit-grid opacity-[0.04]" />

          {/* Layer 4: Noise texture */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay" xmlns="http://www.w3.org/2000/svg">
            <filter id="workshop-patina-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.8 0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#workshop-patina-noise)" />
          </svg>
        </div>

        {/* Content wrapper */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
}
