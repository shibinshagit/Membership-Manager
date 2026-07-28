import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Membership Management System',
  description: 'Complete membership management solution with member tracking, documents, fees, and communications',
  generator: 'shah',
  icons: {
    icon: [
      {
        url: '/opencoders-black.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/opencoders-black.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/opencoders-black.png',
        type: 'image/svg+xml',
      },
    ],
    apple: '/opencoders-black.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
