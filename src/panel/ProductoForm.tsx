import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  GENEROS,
  TALLES_RAPIDOS,
  sumarTalles,
  validarProducto,
  type ColorForm,
  type ProductoForm as Datos,
} from '../lib/producto'
import { extension, rutaGrilla } from '../lib/imagen'
import { supabase } from '../lib/supabase'
import FotosColor from './FotosColor'

type Props = {
  tiendaId: string
  productoId: string | null // null = nuevo
  categorias: { id: string; nombre: string }[]
  onCerrar: () => void
  onGuardado: () => void
}

const VACIO: Datos = { nombre: '', descripcion: '', precio: '', categoria_id: '', genero: '', colores: [] }
const nuevoColor = (talles: ColorForm['talles'] = []): ColorForm => ({
  key: crypto.randomUUID(),
  nombre: '',
  talles: talles.map((t) => ({ ...t, sin_stock: false })),
  fotos: [],
})

const urlPublica = (path: string) => supabase.storage.from('fotos').getPublicUrl(path).data.publicUrl

/** Panel lateral en PC, pantalla completa en el celular. <dialog> da foco atrapado y Esc. */
export default function ProductoForm({ tiendaId, productoId, categorias, onCerrar, onGuardado }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [datos, setDatos] = useState<Datos | null>(productoId ? null : { ...VACIO, colores: [nuevoColor()] })
  // Después del primer intento de guardar, los errores se recalculan en cada cambio.
  const [intentado, setIntentado] = useState(false)
  const errores = intentado && datos ? validarProducto(datos) : {}
  const hayErrores = Object.keys(errores).length > 0
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [coloresUsados, setColoresUsados] = useState<string[]>([])
  // Rutas de las fotos al abrir el producto: las que falten al guardar se borran.
  const [fotosIniciales, setFotosIniciales] = useState<string[]>([])

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  // Colores ya usados en la tienda, para sugerirlos (SRS 3.4.3.2.1).
  useEffect(() => {
    supabase
      .from('producto_color')
      .select('nombre, producto!inner(categoria!inner(tienda_id))')
      .eq('producto.categoria.tienda_id', tiendaId)
      .then(({ data }) => setColoresUsados([...new Set(data?.map((c) => c.nombre as string))].sort()))
  }, [tiendaId])

  useEffect(() => {
    if (!productoId) return
    supabase
      .from('producto')
      .select(
        'nombre, descripcion, precio, categoria_id, genero, categoria!inner(tienda_id), producto_color(id, nombre, orden, color_talle(talle, sin_stock, orden), color_foto(path, orden))',
      )
      .eq('id', productoId)
      .eq('categoria.tienda_id', tiendaId)
      .maybeSingle()
      .then(({ data: p, error }) => {
        if (error || !p) return setErrorGeneral('No encontramos este producto. Puede que se haya eliminado.')
        type Fila = {
          id: string
          nombre: string
          orden: number
          color_talle: { talle: string; sin_stock: boolean; orden: number }[]
          color_foto: { path: string; orden: number }[]
        }
        const porOrden = (a: { orden: number }, b: { orden: number }) => a.orden - b.orden
        const colores = p.producto_color as Fila[]
        setFotosIniciales(colores.flatMap((c) => c.color_foto.map((f) => f.path)))
        setDatos({
          nombre: p.nombre,
          descripcion: p.descripcion ?? '',
          precio: String(p.precio),
          categoria_id: p.categoria_id,
          genero: p.genero,
          colores: colores.sort(porOrden).map((c) => ({
            key: c.id,
            id: c.id,
            nombre: c.nombre,
            talles: c.color_talle.sort(porOrden).map(({ talle, sin_stock }) => ({ talle, sin_stock })),
            fotos: c.color_foto.sort(porOrden).map(({ path }) => ({ key: path, path, vista: urlPublica(rutaGrilla(path)) })),
          })),
        })
      })
  }, [productoId, tiendaId])

  function cambiar(cambios: Partial<Datos>) {
    setDatos((d) => d && { ...d, ...cambios })
  }
  function cambiarColor(key: string, cambios: Partial<ColorForm>) {
    setDatos((d) => d && { ...d, colores: d.colores.map((c) => (c.key === key ? { ...c, ...cambios } : c)) })
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!datos) return
    setIntentado(true)
    setErrorGeneral('')
    if (Object.keys(validarProducto(datos)).length) return
    setGuardando(true)
    try {
      await guardar(datos, productoId, tiendaId, fotosIniciales)
      onGuardado()
    } catch {
      setErrorGeneral('No pudimos guardar el producto. Revisá la conexión y probá de nuevo.')
      setGuardando(false)
    }
  }

  const titulo = productoId ? 'Editar producto' : 'Nuevo producto'

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      aria-label={titulo}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-paper text-ink backdrop:bg-ink/40 md:ml-auto md:max-w-xl"
    >
      <form onSubmit={enviar} noValidate className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-bone px-4 py-2 md:px-8 md:py-4">
          <h2 className="text-xl font-semibold">{titulo}</h2>
          <button type="button" className="grid size-11 place-items-center hover:bg-bone" onClick={onCerrar} aria-label="Cerrar">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          {!datos ? (
            errorGeneral ? (
              <p role="alert" className="text-sm text-red-700">
                {errorGeneral}
              </p>
            ) : (
              <div aria-label="Cargando" className="flex animate-pulse flex-col gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-11 bg-bone" />
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-6">
              <Campo id="p-nombre" label="Nombre" error={errores.nombre}>
                <input
                  id="p-nombre"
                  className="campo"
                  value={datos.nombre}
                  maxLength={80}
                  placeholder="Ej: Remera lisa de algodón"
                  onChange={(e) => cambiar({ nombre: e.target.value })}
                  aria-invalid={!!errores.nombre}
                  aria-describedby="p-nombre-error"
                />
              </Campo>

              <Campo id="p-descripcion" label="Descripción (opcional)" error={errores.descripcion}>
                <textarea
                  id="p-descripcion"
                  className="campo h-24 py-2"
                  value={datos.descripcion}
                  maxLength={300}
                  onChange={(e) => cambiar({ descripcion: e.target.value })}
                  aria-invalid={!!errores.descripcion}
                  aria-describedby="p-descripcion-error"
                />
              </Campo>

              <div className="grid grid-cols-2 gap-3">
                <Campo id="p-precio" label="Precio" error={errores.precio}>
                  <div className="flex">
                    <span className="flex h-11 shrink-0 items-center border border-r-0 border-ink bg-bone px-3 text-base">$</span>
                    <input
                      id="p-precio"
                      className="campo min-w-0"
                      inputMode="numeric"
                      value={datos.precio ? Number(datos.precio).toLocaleString('es-AR') : ''}
                      onChange={(e) => cambiar({ precio: e.target.value.replace(/\D/g, '').slice(0, 9) })}
                      aria-invalid={!!errores.precio}
                      aria-describedby="p-precio-error"
                    />
                  </div>
                </Campo>

                <Campo id="p-categoria" label="Categoría" error={errores.categoria}>
                  <select
                    id="p-categoria"
                    className="campo"
                    value={datos.categoria_id}
                    onChange={(e) => cambiar({ categoria_id: e.target.value })}
                    aria-invalid={!!errores.categoria}
                    aria-describedby="p-categoria-error"
                  >
                    <option value="">Elegir</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>

              <fieldset aria-describedby="p-genero-error">
                <legend className="etiqueta mb-2">Para quién es</legend>
                <div className="flex flex-wrap gap-2">
                  {GENEROS.map((g) => (
                    <label key={g.valor} className="chip has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-cobalt">
                      <input
                        type="radio"
                        name="genero"
                        value={g.valor}
                        checked={datos.genero === g.valor}
                        onChange={() => cambiar({ genero: g.valor })}
                        className="sr-only"
                      />
                      {g.nombre}
                    </label>
                  ))}
                </div>
                <MensajeError id="p-genero-error" texto={errores.genero} />
              </fieldset>

              <section aria-labelledby="p-colores">
                <h3 id="p-colores" className="etiqueta mt-4 border-b border-ink pb-2">
                  Colores
                </h3>
                <MensajeError texto={errores.colores} />
                <datalist id="colores-usados">
                  {coloresUsados.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>

                <div className="mt-4 flex flex-col gap-4">
                  {datos.colores.map((c, i) => (
                    <BloqueColor
                      key={c.key}
                      color={c}
                      numero={i + 1}
                      errores={errores}
                      onCambiar={(cambios) => cambiarColor(c.key, cambios)}
                      onQuitar={() => cambiar({ colores: datos.colores.filter((x) => x.key !== c.key) })}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="boton mt-4 w-full"
                  onClick={() => cambiar({ colores: [...datos.colores, nuevoColor(datos.colores.at(-1)?.talles)] })}
                >
                  Agregar color
                </button>
              </section>
            </div>
          )}
        </div>

        <footer className="border-t border-bone px-4 py-3 md:px-8">
          {datos && (errorGeneral || hayErrores) && (
            <p role="alert" className="mb-3 text-sm text-red-700">
              {errorGeneral || 'Revisá los campos marcados.'}
            </p>
          )}
          <div className="flex gap-3">
            <button type="button" className="boton" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="boton flex-1" disabled={!datos || guardando}>
              {guardando ? 'Guardando' : 'Guardar'}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  )
}

function BloqueColor(props: {
  color: ColorForm
  numero: number
  errores: Record<string, string>
  onCambiar: (c: Partial<ColorForm>) => void
  onQuitar: () => void
}) {
  const { color, errores } = props
  const [otro, setOtro] = useState('')
  const id = `color-${color.key}`
  const errNombre = errores[`${color.key}.nombre`]
  const errTalles = errores[`${color.key}.talles`]

  function agregarOtro() {
    props.onCambiar({ talles: sumarTalles(color.talles, [otro.slice(0, 10)]) })
    setOtro('')
  }

  return (
    <div className="border border-bone p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor={id} className="etiqueta mb-2 block">
            Color {props.numero}
          </label>
          <input
            id={id}
            className="campo"
            list="colores-usados"
            value={color.nombre}
            maxLength={30}
            placeholder="Ej: Negro"
            onChange={(e) => props.onCambiar({ nombre: e.target.value })}
            aria-invalid={!!errNombre}
            aria-describedby={`${id}-error`}
          />
        </div>
        <button
          type="button"
          className="grid size-11 shrink-0 place-items-center hover:bg-bone"
          onClick={props.onQuitar}
          aria-label={`Quitar color ${color.nombre || props.numero}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </div>
      <MensajeError id={`${id}-error`} texto={errNombre} />

      <FotosColor
        fotos={color.fotos}
        etiqueta={color.nombre || `color ${props.numero}`}
        error={errores[`${color.key}.fotos`]}
        errorId={`${id}-fotos-error`}
        onCambiar={(fotos) => props.onCambiar({ fotos })}
      />

      <p className="etiqueta mt-4 mb-2">Talles</p>
      <div className="flex flex-wrap gap-2">
        {TALLES_RAPIDOS.map((l) => {
          // Un toque suma la lista entera; otro toque la saca.
          const puesta = l.talles.every((t) => color.talles.some((x) => x.talle.toLowerCase() === t.toLowerCase()))
          return (
            <button
              type="button"
              key={l.nombre}
              aria-pressed={puesta}
              className="chip aria-pressed:bg-ink aria-pressed:text-paper"
              onClick={() =>
                props.onCambiar({
                  talles: puesta
                    ? color.talles.filter((x) => !l.talles.some((t) => t.toLowerCase() === x.talle.toLowerCase()))
                    : sumarTalles(color.talles, l.talles),
                })
              }
            >
              {l.nombre}
            </button>
          )
        })}
      </div>

      {color.talles.length > 0 && (
        <>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Talles de ${color.nombre || `color ${props.numero}`}`}>
            {color.talles.map((t) => (
              <li key={t.talle} className="flex border border-ink">
                <button
                  type="button"
                  aria-pressed={t.sin_stock}
                  aria-label={`${t.talle}: ${t.sin_stock ? 'sin stock' : 'con stock'}`}
                  className="min-h-11 min-w-11 px-3 text-sm aria-pressed:bg-bone aria-pressed:text-graphite aria-pressed:line-through"
                  onClick={() =>
                    props.onCambiar({
                      talles: color.talles.map((x) => (x.talle === t.talle ? { ...x, sin_stock: !x.sin_stock } : x)),
                    })
                  }
                >
                  {t.talle}
                </button>
                <button
                  type="button"
                  aria-label={`Quitar talle ${t.talle}`}
                  className="grid w-11 place-items-center border-l border-bone text-graphite hover:bg-bone hover:text-ink"
                  onClick={() => props.onCambiar({ talles: color.talles.filter((x) => x.talle !== t.talle) })}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
                    <path d="M3 3l10 10M13 3L3 13" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-graphite">Tocá un talle para marcarlo sin stock (queda tachado); la ✕ lo quita.</p>
        </>
      )}

      <div className="mt-3 flex gap-2">
        <input
          className="campo min-w-0"
          value={otro}
          maxLength={10}
          placeholder="Otro talle"
          aria-label="Otro talle"
          onChange={(e) => setOtro(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              agregarOtro()
            }
          }}
        />
        <button type="button" className="boton shrink-0" onClick={agregarOtro} disabled={!otro.trim()}>
          Sumar
        </button>
      </div>
      <MensajeError texto={errTalles} />
    </div>
  )
}

function Campo(props: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={props.id} className="etiqueta mb-2 block">
        {props.label}
      </label>
      {props.children}
      <MensajeError id={`${props.id}-error`} texto={props.error} />
    </div>
  )
}

function MensajeError({ id, texto }: { id?: string; texto?: string }) {
  if (!texto) return null
  return (
    <p id={id} role="alert" className="mt-2 text-sm text-red-700">
      {texto}
    </p>
  )
}

/**
 * Guarda producto, colores, talles y fotos. Los colores conservan su id (las fotos cuelgan de él);
 * los talles se reemplazan enteros porque nada los referencia.
 * Fotos: {tienda}/{producto}/{color}/{uuid}.webp para el detalle y {uuid}_g.webp para la grilla.
 * ponytail: son varias consultas sin transacción. Si falla a mitad de una edición, el formulario
 * conserva todo y alcanza con volver a guardar. Si molesta, pasar a una función RPC en la base.
 */
async function guardar(d: Datos, productoId: string | null, tiendaId: string, fotosIniciales: string[]) {
  const fila = {
    nombre: d.nombre.trim(),
    descripcion: d.descripcion.trim() || null,
    precio: Number(d.precio),
    categoria_id: d.categoria_id,
    genero: d.genero,
  }
  const ok = <T,>(r: { data: T; error: unknown }) => {
    if (r.error) throw r.error
    return r.data as NonNullable<T>
  }

  const id = productoId
    ? (ok(await supabase.from('producto').update(fila).eq('id', productoId)), productoId)
    : ok(await supabase.from('producto').insert(fila).select('id').single()).id

  const subidas: string[] = [] // archivos subidos en este intento, para limpiarlos si algo falla
  const actuales = new Set(d.colores.flatMap((c) => c.fotos.map((f) => f.path)))
  const quitadas = fotosIniciales.filter((p) => !actuales.has(p))

  try {
    const existentes = d.colores.filter((c) => c.id).map((c) => c.id!)
    if (productoId) {
      // Las fotos de los colores borrados se van en cascada; sus archivos se borran al final.
      let borrar = supabase.from('producto_color').delete().eq('producto_id', id)
      if (existentes.length) borrar = borrar.not('id', 'in', `(${existentes.join(',')})`)
      ok(await borrar)
    }

    await Promise.all(
      d.colores
        .map((c, orden) => ({ c, orden }))
        .filter(({ c }) => c.id)
        .map(async ({ c, orden }) =>
          ok(await supabase.from('producto_color').update({ nombre: c.nombre.trim(), orden }).eq('id', c.id!)),
        ),
    )

    const nuevos = d.colores.map((c, orden) => ({ c, orden })).filter(({ c }) => !c.id)
    const insertados: { id: string; nombre: string }[] = nuevos.length
      ? ok(
          await supabase
            .from('producto_color')
            .insert(nuevos.map(({ c, orden }) => ({ producto_id: id, nombre: c.nombre.trim(), orden })))
            .select('id, nombre'),
        )
      : []
    const idDe = (c: ColorForm) => c.id ?? insertados.find((x) => x.nombre === c.nombre.trim())!.id
    const colorIds = d.colores.map(idDe)

    ok(await supabase.from('color_talle').delete().in('color_id', colorIds))
    ok(
      await supabase.from('color_talle').insert(
        d.colores.flatMap((c) =>
          c.talles.map((t, orden) => ({ color_id: idDe(c), talle: t.talle, sin_stock: t.sin_stock, orden })),
        ),
      ),
    )

    // Fotos: primero se quitan las que ya no están (el límite de 5 por color lo controla la base al insertar).
    if (quitadas.length) ok(await supabase.from('color_foto').delete().in('path', quitadas))
    const lista = d.colores.flatMap((c) => c.fotos.map((f, orden) => ({ f, orden, colorId: idDe(c) })))
    await Promise.all(
      lista
        .filter(({ f }) => f.path)
        .map(async ({ f, orden }) => ok(await supabase.from('color_foto').update({ orden }).eq('path', f.path!))),
    )
    const filas = await Promise.all(
      lista
        .filter(({ f }) => f.nueva)
        .map(async ({ f, orden, colorId }) => {
          const { detalle, grilla } = f.nueva!
          const path = `${tiendaId}/${id}/${colorId}/${crypto.randomUUID()}.${extension(detalle)}`
          const opciones = { contentType: detalle.type, cacheControl: '31536000' } // nombre único: no cambia nunca
          subidas.push(path, rutaGrilla(path))
          ok(await supabase.storage.from('fotos').upload(path, detalle, opciones))
          ok(await supabase.storage.from('fotos').upload(rutaGrilla(path), grilla, opciones))
          return { color_id: colorId, path, orden }
        }),
    )
    if (filas.length) ok(await supabase.from('color_foto').insert(filas))
  } catch (e) {
    if (subidas.length) await supabase.storage.from('fotos').remove(subidas)
    // Alta a medias: se borra el producto (en cascada) para no dejar uno incompleto.
    if (!productoId) await supabase.from('producto').delete().eq('id', id)
    throw e
  }

  // ponytail: si falla, quedan archivos sueltos en Storage; no afecta al catálogo.
  if (quitadas.length) await supabase.storage.from('fotos').remove(quitadas.flatMap((p) => [p, rutaGrilla(p)]))
}
