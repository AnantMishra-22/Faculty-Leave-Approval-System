import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FacultyDashboardClient from '@/components/faculty/FacultyDashboardClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Faculty Dashboard | CMR Leave System',
}

export default async function FacultyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Try to get or create profile
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // If no profile exists yet (user created via Auth dashboard before migration),
  // create one now so they can use the app
  if (!profile) {
    const { data: newProfile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || user.email!.split('@')[0],
        role: user.user_metadata?.role || 'faculty',
      })
      .select('*')
      .single()
    profile = newProfile
  }

  if (!profile) redirect('/login')
  if (profile.role === 'hod') redirect('/hod')

  return <FacultyDashboardClient profile={profile} />
}
