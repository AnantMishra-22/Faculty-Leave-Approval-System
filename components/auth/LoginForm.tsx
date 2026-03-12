'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCredentials, setShowCredentials] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.session) {
      setError(authError?.message || 'Login failed. Check your credentials.')
      setLoading(false)
      return
    }

    // Fetch role and redirect
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.session.user.id)
      .single()

    router.push(profile?.role === 'hod' ? '/hod' : '/faculty')
    router.refresh()
  }

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-[480px] flex flex-col items-center">

        {/* Logo */}
        <div className="mb-8 w-24 h-24 rounded-full bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center overflow-hidden border-2 border-primary/20">
          <img
            alt="CMR Technical Campus Logo"
            className="w-20 h-20 object-contain"
            src="/logo.png"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDr0zKvBtQTG2Aw5FzG34qBvuzNqBl-vlyBYZpumGJD4oP2Yk0Dh0r6xa2zl_zvUReSYhcF-XYPbT1fZljcNoJMSsH0z7MFCUqiOYb6Sk-S--83R_EQTObfkHLQf5UGdImDcqSfqQZiWnOibj_yNBa0DgPzdI8aRilXGYmCiTjfL99S2h7FwgRrEyhF6IUF2LCYNihHv6RDPgw9ZIlTfTqq1xruPn0Tq-_4SgUxwLaWSm5yvJQ9YHn4vSZWXVBaut0gP9XsnvVDBQuV'
            }}
          />
        </div>

        {/* Header */}
        <div className="text-center mb-8 px-4">
          <h1 className="text-slate-900 dark:text-slate-100 text-3xl font-bold tracking-tight leading-tight">
            Faculty Leave Approval System
          </h1>
          <h2 className="text-primary text-lg font-semibold mt-2">
            CSE (AI &amp; ML) Department
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-4">
            Secure portal for leave management and approvals.
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-white dark:bg-slate-900/50 rounded-xl shadow-xl p-6 border border-slate-200 dark:border-slate-800">
          <form className="space-y-5" onSubmit={handleSubmit}>

            {/* Error message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {error}
              </div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 dark:text-slate-300 text-sm font-medium">Email Address</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="faculty@cmrtc.ac.in"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 dark:text-slate-300 text-sm font-medium">Password</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">lock</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-12 py-3 bg-background-light dark:bg-background-dark border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-primary font-medium hover:underline">Forgot password?</a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-70 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Login to Dashboard</span>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Credentials */}
        <div className="mt-8 w-full">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <button
              onClick={() => setShowCredentials(!showCredentials)}
              className="flex items-center gap-2 mb-2 w-full text-left"
            >
              <span className="material-symbols-outlined text-primary text-[20px]">info</span>
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex-1">Demo Credentials</span>
              <span className="material-symbols-outlined text-primary text-[18px]">
                {showCredentials ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {showCredentials && (
              <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-primary/10 pb-1">
                  <span className="font-medium">HOD:</span>
                  <code>hod@cseaiml.edu / HOD@12345</code>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Faculty:</span>
                  <code>faculty1@cseaiml.edu / Faculty@1</code>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 text-center">
          <p className="text-slate-400 text-xs">
            © 2024 CMR Technical Campus<br />
            Department of CSE (Artificial Intelligence &amp; Machine Learning)
          </p>
        </footer>
      </div>
    </div>
  )
}
