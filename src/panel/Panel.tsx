import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Tienda } from '../lib/tienda'
import TiendaForm from './TiendaForm'

export default function Panel({ session }: { session: Session }) {
  // undefined = cargando, null = todavía no tiene tienda
  const [tienda, setTienda] = useState<Tienda | null>()
  const [error, setError] = useState('')
  const [editando, setEditando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [versionLogo, setVersionLogo] = useState(0)

  useEffect(() => {
    supabase
      .from('tienda')
      .select('*')
      .eq('owner_id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError('No pudimos cargar tu tienda. Revisá la conexión y recargá la página.')
        else setTienda(data)
      })
  }, [session.user.id])

  function guardada(t: Tienda, avisoLogo = '') {
    setTienda(t)
    setEditando(false)
    setAviso(avisoLogo)
    setVersionLogo(Date.now()) // el logo se reemplaza en la misma ruta: evita ver el anterior en caché
  }

  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-6">
        <span className="etiqueta">Mostra</span>
        <button className="etiqueta min-h-11 text-graphite hover:text-ink" onClick={() => supabase.auth.signOut()}>
          Cerrar sesión
        </button>
      </header>

      <main className="px-4 pt-6 pb-16 md:px-8 md:pt-16">
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : tienda === undefined ? (
          <Esqueleto />
        ) : tienda === null || editando ? (
          <Seccion
            titulo={tienda ? 'Datos de la tienda' : 'Creá tu tienda'}
            bajada={tienda ? 'Si cambiás el link, el anterior deja de funcionar.' : 'Con estos datos armamos tu catálogo y su link.'}
          >
            <TiendaForm userId={session.user.id} tienda={tienda} onGuardada={guardada} onCancelar={() => setEditando(false)} />
          </Seccion>
        ) : (
          <LinkTienda tienda={tienda} versionLogo={versionLogo} aviso={aviso} onEditar={() => setEditando(true)} />
        )}
      </main>
    </div>
  )
}

function LinkTienda(props: { tienda: Tienda; versionLogo: number; aviso: string; onEditar: () => void }) {
  const { tienda, versionLogo } = props
  const [copiado, setCopiado] = useState(false)
  const url = `${location.origin}/${tienda.slug}`
  const logo = tienda.logo_path && `${supabase.storage.from('fotos').getPublicUrl(tienda.logo_path).data.publicUrl}?v=${versionLogo}`

  async function copiar() {
    await navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function compartir() {
    const texto = `Mirá el catálogo de ${tienda.nombre}`
    if (navigator.share) navigator.share({ title: tienda.nombre, text: texto, url }).catch(() => {})
    else open(`https://wa.me/?text=${encodeURIComponent(`${texto}: ${url}`)}`, '_blank')
  }

  return (
    <Seccion
      titulo={
        <span className="flex items-center gap-3 md:flex-col md:items-start md:gap-6">
          {logo && <img src={logo} alt="" className="size-12 object-cover md:size-20" />}
          {tienda.nombre}
        </span>
      }
      bajada="Compartí este link con tus clientes: ven el catálogo y te mandan el pedido por WhatsApp."
    >
      {props.aviso && (
        <p role="alert" className="mb-6 text-sm text-red-700">
          {props.aviso}
        </p>
      )}
      <p className="etiqueta text-graphite">El link de tu catálogo</p>
      <a href={url} className="enlace mt-2 block text-base break-all md:text-2xl">
        {url.replace(/^https?:\/\//, '')}
      </a>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
        <button className="boton" onClick={copiar}>
          Copiar
        </button>
        <button className="boton" onClick={compartir}>
          Compartir
        </button>
      </div>
      <p aria-live="polite" className="mt-2 h-5 text-sm text-graphite">
        {copiado && 'Link copiado'}
      </p>
      <button className="boton mt-10" onClick={props.onEditar}>
        Editar datos de la tienda
      </button>
    </Seccion>
  )
}

/** Título a la izquierda y contenido a la derecha desde tablet; apilados en el celular. */
function Seccion({ titulo, bajada, children }: { titulo: ReactNode; bajada: string; children: ReactNode }) {
  return (
    <section className="grid gap-8 md:grid-cols-12">
      <div className="md:col-span-5 lg:col-span-4">
        <h1 className="text-2xl font-semibold md:text-4xl">{titulo}</h1>
        <p className="mt-2 max-w-sm text-sm text-graphite md:mt-4 md:text-base">{bajada}</p>
      </div>
      <div className="md:col-span-7 lg:col-span-6 lg:col-start-6">{children}</div>
    </section>
  )
}

function Esqueleto() {
  return (
    <div aria-label="Cargando" className="grid animate-pulse gap-8 md:grid-cols-12">
      <div className="md:col-span-5 lg:col-span-4">
        <div className="h-8 w-48 bg-bone md:h-10" />
        <div className="mt-3 h-4 w-64 max-w-full bg-bone" />
      </div>
      <div className="md:col-span-7 lg:col-span-6 lg:col-start-6">
        <div className="h-4 w-32 bg-bone" />
        <div className="mt-3 h-6 w-64 max-w-full bg-bone" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
          <div className="h-11 bg-bone" />
          <div className="h-11 bg-bone" />
        </div>
      </div>
    </div>
  )
}
