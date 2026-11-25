import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Login from './panel/Login'
import Panel from './panel/Panel'

export default function App() {
  // undefined = todavía no se sabe si hay sesión
  const [session, setSession] = useState<Session | null>()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const ruta = location.pathname.replace(/\/+$/, '')
  if (ruta !== '' && ruta !== '/panel') {
    return (
      <main className="p-4">
        <p className="etiqueta">Catálogo en construcción</p>
      </main>
    )
  }

  if (session === undefined) return null
  return session ? <Panel session={session} /> : <Login />
}
