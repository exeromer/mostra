import { useState, type FormEvent, type ReactNode } from 'react'
import { comprimirImagen, extension } from '../lib/imagen'
import { supabase } from '../lib/supabase'
import { aSlug, aWhatsapp, errorSlug, type Tienda } from '../lib/tienda'

type Props = {
  userId: string
  tienda: Tienda | null
  onGuardada: (t: Tienda, avisoLogo?: string) => void
  onCancelar: () => void
}

type Errores = { nombre?: string; slug?: string; whatsapp?: string; general?: string }

export default function TiendaForm({ userId, tienda, onGuardada, onCancelar }: Props) {
  const [nombre, setNombre] = useState(tienda?.nombre ?? '')
  const [slug, setSlug] = useState(tienda?.slug ?? '')
  const [slugTocado, setSlugTocado] = useState(!!tienda)
  const [whatsapp, setWhatsapp] = useState(tienda?.whatsapp.slice(3) ?? '')
  const [logo, setLogo] = useState<File | null>(null)
  const [vistaLogo, setVistaLogo] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [sugerencia, setSugerencia] = useState('')
  const [guardando, setGuardando] = useState(false)

  function cambiarNombre(valor: string) {
    setNombre(valor)
    if (!slugTocado) setSlug(aSlug(valor))
  }

  async function marcarSlug(mensaje: string, base: string) {
    setErrores({ slug: mensaje })
    setSugerencia(await sugerirSlug(base))
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setSugerencia('')
    const nuevos: Errores = {}
    if (!nombre.trim()) nuevos.nombre = 'Escribí el nombre de la tienda.'
    const eSlug = errorSlug(slug)
    if (eSlug) nuevos.slug = eSlug
    const numero = aWhatsapp(whatsapp)
    if (!numero) nuevos.whatsapp = 'Tienen que ser 10 números: código de área sin 0 y número sin 15.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length || !numero) {
      if (eSlug === 'Ese link está reservado.') setSugerencia(await sugerirSlug(slug))
      return
    }

    setGuardando(true)
    const datos = { nombre: nombre.trim(), slug, whatsapp: numero }
    const consulta = tienda
      ? supabase.from('tienda').update(datos).eq('id', tienda.id)
      : supabase.from('tienda').insert({ ...datos, owner_id: userId })
    const { data, error } = await consulta.select().single<Tienda>()

    if (error) {
      setGuardando(false)
      if (error.code === '23505' && error.message.includes('slug')) return marcarSlug('Ese link ya lo usa otra tienda.', slug)
      return setErrores({ general: 'No pudimos guardar la tienda. Revisá la conexión y probá de nuevo.' })
    }

    if (!logo) return onGuardada(data)
    try {
      const blob = await comprimirImagen(logo, 512, 200_000)
      const path = `${data.id}/logo.${extension(blob)}`
      const subida = await supabase.storage
        .from('fotos')
        .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '60' })
      if (subida.error) throw subida.error
      const { data: conLogo, error } = await supabase
        .from('tienda')
        .update({ logo_path: path })
        .eq('id', data.id)
        .select()
        .single<Tienda>()
      if (error) throw error
      onGuardada(conLogo)
    } catch (err) {
      const motivo = err instanceof Error && err.message.startsWith('La imagen') ? err.message : 'Probá de nuevo desde Editar.'
      onGuardada(data, `La tienda se guardó, pero el logo no se pudo subir. ${motivo}`)
    }
  }

  return (
    <form onSubmit={guardar} noValidate className="flex flex-col gap-6 sm:max-w-md">
      <Campo id="nombre" label="Nombre de la tienda" error={errores.nombre}>
        <input
          id="nombre"
          className="campo"
          value={nombre}
          maxLength={60}
          autoComplete="organization"
          onChange={(e) => cambiarNombre(e.target.value)}
          aria-invalid={!!errores.nombre}
          aria-describedby="nombre-error"
        />
      </Campo>

      <Campo id="slug" label="Link" ayuda={`${location.host}/${slug || 'tu-tienda'}`} error={errores.slug}>
        <input
          id="slug"
          className="campo"
          value={slug}
          maxLength={40}
          autoCapitalize="none"
          spellCheck={false}
          onChange={(e) => {
            setSlugTocado(true)
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
          }}
          aria-invalid={!!errores.slug}
          aria-describedby="slug-ayuda slug-error"
        />
        {sugerencia && (
          <button
            type="button"
            className="enlace mt-2 min-h-11 text-sm"
            onClick={() => {
              setSlug(sugerencia)
              setSugerencia('')
              setErrores({})
            }}
          >
            Usar {sugerencia}
          </button>
        )}
      </Campo>

      <Campo id="whatsapp" label="WhatsApp" ayuda="Código de área sin 0 y número sin 15. Ej: 11 2345 6789" error={errores.whatsapp}>
        <div className="flex">
          <span className="flex h-11 shrink-0 items-center border border-r-0 border-ink bg-bone px-3 text-base whitespace-nowrap">+54 9</span>
          <input
            id="whatsapp"
            className="campo"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            aria-invalid={!!errores.whatsapp}
            aria-describedby="whatsapp-ayuda whatsapp-error"
          />
        </div>
      </Campo>

      <Campo id="logo" label="Logo (opcional)" ayuda={tienda?.logo_path ? 'Elegí una imagen para reemplazar el logo actual.' : undefined}>
        <input
          id="logo"
          type="file"
          accept="image/*"
          className="block w-full text-sm file:etiqueta file:mr-3 file:min-h-11 file:border file:border-ink file:bg-paper file:px-3"
          onChange={(e) => {
            const archivo = e.target.files?.[0] ?? null
            setLogo(archivo)
            URL.revokeObjectURL(vistaLogo)
            setVistaLogo(archivo ? URL.createObjectURL(archivo) : '')
          }}
          aria-describedby="logo-ayuda"
        />
        {vistaLogo && <img src={vistaLogo} alt="Vista previa del logo" className="mt-3 size-16 object-cover" />}
      </Campo>

      {errores.general && (
        <p role="alert" className="text-sm text-red-700">
          {errores.general}
        </p>
      )}

      <div className="flex gap-3">
        <button className="boton flex-1" disabled={guardando}>
          {guardando ? 'Guardando' : tienda ? 'Guardar cambios' : 'Crear tienda'}
        </button>
        {tienda && (
          <button type="button" className="boton" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

function Campo(props: { id: string; label: string; ayuda?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={props.id} className="etiqueta mb-2 block">
        {props.label}
      </label>
      {props.children}
      {props.ayuda && (
        <p id={`${props.id}-ayuda`} className="mt-2 text-sm text-graphite">
          {props.ayuda}
        </p>
      )}
      {props.error && (
        <p id={`${props.id}-error`} role="alert" className="mt-2 text-sm text-red-700">
          {props.error}
        </p>
      )}
    </div>
  )
}

/** Primer "base-N" libre (SRS caso de uso 1, flujo alternativo). */
async function sugerirSlug(base: string) {
  const raiz = aSlug(base).slice(0, 37).replace(/-+$/, '') || 'tienda'
  const opciones = [2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${raiz}-${n}`)
  const { data } = await supabase.from('tienda').select('slug').in('slug', opciones)
  const usados = new Set(data?.map((t) => t.slug))
  return opciones.find((o) => !usados.has(o)) ?? ''
}
