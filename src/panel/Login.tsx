import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [error, setError] = useState(() =>
    new URLSearchParams(location.search).has('error') ? 'No pudimos completar el ingreso con Google. Probá de nuevo o contacta al administrador.' : '',
  )
  const [yendo, setYendo] = useState(false)

  async function ingresar() {
    setYendo(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/panel` },
    })
    if (error) {
      setError('No pudimos conectar con Google. Probá de nuevo en unos segundos.')
      setYendo(false)
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-between gap-12 p-4 md:grid md:grid-cols-2 md:grid-rows-[auto_1fr] md:p-8">
      <p className="etiqueta md:col-span-2">Para vendedores</p>

      <div className="md:self-end">
        <h1 className="text-7xl font-medium tracking-tight md:text-8xl lg:text-9xl">Mostra</h1>
        <p className="mt-4 max-w-sm text-base text-graphite md:text-lg">
          Tu catálogo de ropa con link propio. Tus clientes arman el pedido y te llega por WhatsApp.
        </p>
      </div>

      <div className="flex flex-col gap-3 md:w-full md:max-w-sm md:self-end md:justify-self-end">
        <button className="boton w-full" onClick={ingresar} disabled={yendo}>
          {yendo ? 'Abriendo Google' : 'Ingresar con Google'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
