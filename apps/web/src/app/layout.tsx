import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'SaaSyToad Forge',
  description: 'Agent-first coding workspace. Describe the task, watch it ship.',
}

// Apply the brand theme before paint; honor a saved slate preference with no flash.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('forge:theme');if(t==='slate'){document.body.classList.remove('theme-steampunk');document.body.classList.add('theme-slate');}}catch(e){}})();`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="theme-steampunk" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  )
}
