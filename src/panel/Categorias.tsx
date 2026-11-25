import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { BotonIcono, ConfirmarBorrado } from './BotonIcono'
import { Esqueleto, Seccion } from './Seccion'

type Categoria = { id: string; nombre: string; orden: number; productos: number }

const ERROR_RED = 'No pudimos guardar el cambio. Revisá la conexión y probá de nuevo.'

export default function Categorias({ tiendaId }: { tiendaId: string }) {
  const [lista, setLista] = useState<Categoria[]>()
  const [error, setError] = useState('')
  // Qué fila muestra edición o confirmación de borrado (una por vez).
  const [accion, setAccion] = useState<{ id: string; modo: 'editar' | 'borrar' } | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [recargas, setRecargas] = useState(0) // sumar 1 vuelve a traer la lista de la base

  useEffect(() => {
    supabase
      .from('categoria')
      .select('id, nombre, orden, producto(count)')
      .eq('tienda_id', tiendaId)
      .order('orden')
      .order('created_at')
      .then(({ data, error }) => {
        if (error) return setError('No pudimos cargar las categorías. Revisá la conexión y recargá la página.')
        setLista(data.map((c) => ({ id: c.id, nombre: c.nombre, orden: c.orden, productos: c.producto[0]?.count ?? 0 })))
      })
  }, [tiendaId, recargas])

  /** Devuelve el mensaje de error o null si el nombre sirve. */
  function errorNombre(nombre: string, id?: string) {
    if (!nombre) return 'Escribí un nombre.'
    if (lista?.some((c) => c.id !== id && c.nombre.toLowerCase() === nombre.toLowerCase()))
      return 'Ya tenés una categoría con ese nombre.'
    return null
  }

  async function crear(nombre: string) {
    const orden = Math.max(0, ...(lista ?? []).map((c) => c.orden)) + 1
    const { data, error } = await supabase
      .from('categoria')
      .insert({ tienda_id: tiendaId, nombre, orden })
      .select('id, nombre, orden')
      .single()
    if (error) return error.code === '23505' ? 'Ya tenés una categoría con ese nombre.' : ERROR_RED
    setLista((l) => [...(l ?? []), { ...data, productos: 0 }])
    return null
  }

  async function renombrar(c: Categoria, nombre: string) {
    const { error } = await supabase.from('categoria').update({ nombre }).eq('id', c.id)
    if (error) return error.code === '23505' ? 'Ya tenés una categoría con ese nombre.' : ERROR_RED
    setLista((l) => l?.map((x) => (x.id === c.id ? { ...x, nombre } : x)))
    setAccion(null)
    return null
  }

  async function eliminar(c: Categoria) {
    setBorrando(true)
    const { error } = await supabase.from('categoria').delete().eq('id', c.id)
    setBorrando(false)
    setAccion(null)
    // 23503: la base no deja borrarla porque tiene productos (puede pasar si se cargó uno recién).
    if (error) return setError(error.code === '23503' ? `${c.nombre} tiene productos: movelos a otra categoría antes de eliminarla.` : ERROR_RED)
    setError('')
    setLista((l) => l?.filter((x) => x.id !== c.id))
  }

  /** Intercambia el orden con la vecina de arriba (-1) o de abajo (+1). */
  async function mover(i: number, paso: -1 | 1) {
    if (!lista) return
    const a = lista[i]
    const b = lista[i + paso]
    // Si dos tienen el mismo orden, usar la posición para que el cambio se note.
    const [ordenA, ordenB] = a.orden === b.orden ? [i + paso, i] : [b.orden, a.orden]
    const nueva = [...lista]
    nueva[i] = { ...b, orden: ordenB }
    nueva[i + paso] = { ...a, orden: ordenA }
    setLista(nueva)
    setError('')
    const [r1, r2] = await Promise.all([
      supabase.from('categoria').update({ orden: ordenA }).eq('id', a.id),
      supabase.from('categoria').update({ orden: ordenB }).eq('id', b.id),
    ])
    if (r1.error || r2.error) {
      setError(ERROR_RED)
      setRecargas((n) => n + 1)
    }
  }

  if (error && !lista) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {error}
      </p>
    )
  }
  if (!lista) return <Esqueleto filas={6} />

  return (
    <Seccion
      titulo="Categorías"
      bajada="Ordenalas como querés que aparezcan en tu catálogo. Las que no tienen productos visibles no se muestran."
    >
      <NuevaCategoria validar={errorNombre} onCrear={crear} />

      {error && (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {error}
        </p>
      )}

      {lista.length === 0 ? (
        <p className="mt-10 text-sm text-graphite">Todavía no tenés categorías. Creá la primera con el campo de arriba.</p>
      ) : (
        <ol className="mt-10 border-t border-bone">
          {lista.map((c, i) => {
            const modo = accion?.id === c.id ? accion.modo : null
            const cantidad = c.productos === 1 ? '1 producto' : `${c.productos} productos`
            if (modo === 'editar') {
              return (
                <EditarCategoria
                  key={c.id}
                  categoria={c}
                  validar={(n) => errorNombre(n, c.id)}
                  onRenombrar={(n) => renombrar(c, n)}
                  onCancelar={() => setAccion(null)}
                />
              )
            }
            if (modo === 'borrar') {
              return (
                <li key={c.id} className="border-b border-bone">
                  {c.productos > 0 ? (
                    <div role="alert" className="py-3">
                      <p className="text-base">No se puede eliminar {c.nombre}</p>
                      <p className="mt-1 text-sm text-graphite">
                        Tiene {cantidad}. Movelos a otra categoría o eliminalos primero.
                      </p>
                      <button type="button" className="boton mt-3 w-full" onClick={() => setAccion(null)} autoFocus>
                        Entendido
                      </button>
                    </div>
                  ) : (
                    <ConfirmarBorrado
                      texto={`¿Eliminar la categoría ${c.nombre}?`}
                      detalle="No tiene productos. Esto no se puede deshacer."
                      ocupado={borrando}
                      onCancelar={() => setAccion(null)}
                      onBorrar={() => eliminar(c)}
                    />
                  )}
                </li>
              )
            }
            return (
              <li key={c.id} className="flex items-center border-b border-bone">
                <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2">
                  <span className="truncate text-base">{c.nombre}</span>
                  <span className="text-xs text-graphite">{cantidad}</span>
                </div>
                <BotonIcono icono="arriba" etiqueta={`Subir ${c.nombre}`} disabled={i === 0} onClick={() => mover(i, -1)} />
                <BotonIcono icono="abajo" etiqueta={`Bajar ${c.nombre}`} disabled={i === lista.length - 1} onClick={() => mover(i, 1)} />
                <BotonIcono icono="editar" etiqueta={`Editar ${c.nombre}`} onClick={() => setAccion({ id: c.id, modo: 'editar' })} />
                <BotonIcono icono="borrar" etiqueta={`Eliminar ${c.nombre}`} onClick={() => setAccion({ id: c.id, modo: 'borrar' })} />
              </li>
            )
          })}
        </ol>
      )}
    </Seccion>
  )
}

function NuevaCategoria(props: { validar: (n: string) => string | null; onCrear: (n: string) => Promise<string | null> }) {
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const limpio = nombre.trim()
    const invalido = props.validar(limpio)
    if (invalido) return setError(invalido)
    setGuardando(true)
    const fallo = await props.onCrear(limpio)
    setGuardando(false)
    setError(fallo ?? '')
    if (!fallo) setNombre('')
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label htmlFor="nueva-categoria" className="etiqueta mb-2 block">
        Nueva categoría
      </label>
      <div className="flex gap-3">
        <input
          id="nueva-categoria"
          className="campo min-w-0"
          value={nombre}
          maxLength={40}
          placeholder="Ej: Mallas"
          onChange={(e) => setNombre(e.target.value)}
          aria-invalid={!!error}
          aria-describedby="nueva-categoria-error"
        />
        <button className="boton shrink-0" disabled={guardando}>
          Agregar
        </button>
      </div>
      {error && (
        <p id="nueva-categoria-error" role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  )
}

function EditarCategoria(props: {
  categoria: Categoria
  validar: (n: string) => string | null
  onRenombrar: (n: string) => Promise<string | null>
  onCancelar: () => void
}) {
  const { categoria } = props
  const [nombre, setNombre] = useState(categoria.nombre)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const id = `categoria-${categoria.id}`

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const limpio = nombre.trim()
    if (limpio === categoria.nombre) return props.onCancelar()
    const invalido = props.validar(limpio)
    if (invalido) return setError(invalido)
    setOcupado(true)
    setError((await props.onRenombrar(limpio)) ?? '')
    setOcupado(false)
  }

  return (
    <li className="border-b border-bone py-4">
      <form onSubmit={guardar} noValidate>
        <label htmlFor={id} className="etiqueta mb-2 block">
          Nombre
        </label>
        <input
          id={id}
          className="campo"
          value={nombre}
          maxLength={40}
          autoFocus
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && props.onCancelar()}
          aria-invalid={!!error}
          aria-describedby={`${id}-error`}
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="boton flex-1" disabled={ocupado}>
            Guardar
          </button>
          <button type="button" className="boton" onClick={props.onCancelar}>
            Cancelar
          </button>
        </div>
      </form>
    </li>
  )
}
