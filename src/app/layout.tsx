import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import 'material-symbols'
import './globals.css'
import { AuthModal } from '@/components/auth/AuthModal'
import { AuthProvider } from '@/components/auth/AuthProvider'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' })

export const metadata: Metadata = {
  title: 'MammaLog - Daily Meal Log',
  description: 'Smart & Minimal Dashboard for Baby Meal Logs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light">
      <body className={`${manrope.variable} font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 transition-colors duration-300 min-h-screen flex flex-col`}>
        <AuthProvider>
          {children}
          <AuthModal />
        </AuthProvider>
      </body>
    </html>
  )
}
