'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  logoSrc?: string
  title: string
  subtitle?: string
  showNotification?: boolean
  showLogout?: boolean
  avatarInitials?: string
}

export default function Header({
  logoSrc,
  title,
  subtitle,
  showNotification = true,
  showLogout = false,
  avatarInitials = 'U',
}: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden">
          <img
            alt="CMR Logo"
            className="h-8 w-8 object-contain"
            src={logoSrc || '/logo.png'}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnrwTjigiZAhlLeFnycMqIRckn9EG8ncVdQXUxES6DpayAlRnz8gFn5uSlxW3fh5GZE7IKVCEFxKL_LuglGPK1yM2nUSXo-afvFDurQBD1dcAIPSr83nspIBT5g0jAZzUDHAzph4JWfoBTzvJ8JxMm6T7e0BJSLbXO-M5mrdHS4tXqVl2udhgupIX5jF_NVLctr71zlH-uLlsrhFkaMlaNiggnvLQDC-Zsz7IQugL2yjYAkg6uzzSfEXm_61YAmkdwbR1qDKWjSVjX'
            }}
          />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight text-primary">{title}</h1>
          {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showNotification && (
          <button className="relative p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-primary" />
          </button>
        )}
        {showLogout && (
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors"
            title="Logout"
          >
            {avatarInitials}
          </button>
        )}
      </div>
    </header>
  )
}
