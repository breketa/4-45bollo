import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/components/auth/AuthProvider'
import PageLayoutClient from '@/components/layout/PageLayoutClient'
import NotificationProvider from '@/components/notifications/NotificationProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SWAPDMARKET - Buy and Sell Social Media Channels',
  description: 'The premier marketplace for buying and selling social media channels and accounts.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen flex flex-col bg-gray-100 w-full max-w-full overflow-x-hidden">
        <AuthProvider>
          <NotificationProvider>
            <PageLayoutClient>{children}</PageLayoutClient>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
