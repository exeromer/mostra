import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Enlace, ir, useRuta } from '../lib/ruta'
import { supabase } from '../lib/supabase'
import type { Tienda } from '../lib/tienda'
import Categorias from './Categorias'
import Productos from './Productos'
import { Esqueleto, Seccion } from './Seccion'
import TiendaForm from './TiendaForm'

const SECCIONES = [
  { ruta: '/panel', nombre: 'Productos' },
  { ruta: '/panel/categorias', nombre: 'Categorías' },
  { ruta: '/panel/tienda', nombre: 'Tienda' },
]

export default function Panel({ session }: { session: Session }) {
  const ruta = useRuta()
  // undefined = cargando, null = todavía no tiene tienda
  const [tienda, setTienda] = useState<Tienda | null>()
  const [error, setError] = useState('')

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

  // /panel/productos/nuevo y /panel/productos/<id> abren el panel del producto sobre la lista.
  const abierto = ruta.match(/^\/panel\/productos\/([\w-]+)$/)?.[1] ?? null
  const seccion = abierto ? '/panel' : SECCIONES.some((s) => s.ruta === ruta) ? ruta : '/panel'
  useEffect(() => {
    if (!abierto && seccion !== ruta) ir(seccion, { reemplazar: true })
  }, [abierto, seccion, ruta])

  return (
    <div className="min-h-dvh">
      <header className="flex flex-wrap items-center justify-between px-4 pt-3 md:flex-nowrap md:gap-8 md:px-8 md:py-6">
        <span className="etiqueta">Mostra</span>
        {tienda && (
          <nav aria-label="Panel" className="order-last -mx-3 flex w-full gap-1 overflow-x-auto md:order-none md:mx-0 md:mr-auto md:w-auto">
            {SECCIONES.map((s) => (
              <Enlace
                key={s.ruta}
                href={s.ruta}
                aria-current={s.ruta === seccion ? 'page' : undefined}
                className="etiqueta inline-flex min-h-11 items-center px-3 whitespace-nowrap text-graphite hover:text-ink aria-[current=page]:text-cobalt"
              >
                {s.nombre}
              </Enlace>
            ))}
          </nav>
        )}
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
        ) : tienda === null ? (
          <Seccion titulo="Creá tu tienda" bajada="Con estos datos armamos tu catálogo y su link.">
            <TiendaForm
              userId={session.user.id}
              tienda={null}
              onGuardada={(t) => {
                setTienda(t)
                ir('/panel/tienda') // muestra el link recién creado (caso de uso 1)
              }}
              onCancelar={() => {}}
            />
          </Seccion>
        ) : seccion === '/panel/categorias' ? (
          <Categorias tiendaId={tienda.id} />
        ) : seccion === '/panel/tienda' ? (
          <DatosTienda tienda={tienda} userId={session.user.id} onGuardada={setTienda} />
        ) : (
          <Productos tiendaId={tienda.id} abierto={abierto} />
        )}
      </main>
    </div>
  )
}

function DatosTienda(props: { tienda: Tienda; userId: string; onGuardada: (t: Tienda) => void }) {
  const { tienda } = props
  const [editando, setEditando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [versionLogo, setVersionLogo] = useState(0)
  const [copiado, setCopiado] = useState(false)
  const url = `${location.origin}/${tienda.slug}`
  const logo = tienda.logo_path && `${supabase.storage.from('fotos').getPublicUrl(tienda.logo_path).data.publicUrl}?v=${versionLogo}`

  function guardada(t: Tienda, avisoLogo = '') {
    props.onGuardada(t)
    setEditando(false)
    setAviso(avisoLogo)
    setVersionLogo(Date.now()) // el logo se reemplaza en la misma ruta: evita ver el anterior en caché
  }

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

  if (editando) {
    return (
      <Seccion titulo="Datos de la tienda" bajada="Si cambiás el link, el anterior deja de funcionar.">
        <TiendaForm userId={props.userId} tienda={tienda} onGuardada={guardada} onCancelar={() => setEditando(false)} />
      </Seccion>
    )
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
      {aviso && (
        <p role="alert" className="mb-6 text-sm text-red-700">
          {aviso}
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
      <button className="boton mt-10" onClick={() => setEditando(true)}>
        Editar datos de la tienda
      </button>
    </Seccion>
  )
}
