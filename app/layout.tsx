import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Faculty Leave Approval System | CMR Technical Campus',
  description: 'Secure leave management portal for CSE (AI & ML) Department faculty',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="font-display antialiased">{children}</body>
    </html>
  )
}
