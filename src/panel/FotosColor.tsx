import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { procesarFoto } from '../lib/imagen'
import { MAX_FOTOS, type FotoForm } from '../lib/producto'
import { supabase } from '../lib/supabase'
import { Icono } from './BotonIcono'

type Props = {
  fotos: FotoForm[]
  etiqueta: string // "Negro" o "color 2", para los lectores de pantalla
  error?: string
  errorId: string
  onCambiar: (fotos: FotoForm[]) => void
}

const mensaje = (err: unknown) =>
  err instanceof Error && err.message.startsWith('La imagen')
    ? err.message
    : 'No pudimos abrir una de las fotos. Probá con una JPG o PNG.'

/** Tira de hasta 5 fotos por color. Cada foto se mejora al elegirla; tocándola se ajusta o se quita. */
export default function FotosColor({ fotos, etiqueta, error, errorId, onCambiar }: Props) {
  const [procesando, setProcesando] = useState(0)
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const libres = MAX_FOTOS - fotos.length
  const foto = fotos.find((f) => f.key === editando)

  async function elegir(e: ChangeEvent<HTMLInputElement>) {
    const archivos = [...(e.target.files ?? [])]
    e.target.value = '' // permite volver a elegir el mismo archivo
    const tomados = archivos.slice(0, libres)
    setAviso(archivos.length > libres ? `Se agregaron ${libres}: el máximo es ${MAX_FOTOS} fotos por color.` : '')
    setProcesando(tomados.length)
    const nuevas: FotoForm[] = []
    // De a una, para no llenar la memoria del celular con varias fotos grandes a la vez.
    for (const original of tomados) {
      try {
        const r = await procesarFoto(original, { mejorar: true, recorte: null })
        nuevas.push({
          key: crypto.randomUUID(),
          vista: URL.createObjectURL(r.grilla),
          nueva: { original, ...r, mejorar: true, recorte: null },
        })
      } catch (err) {
        setAviso(mensaje(err))
      }
      setProcesando((n) => n - 1)
    }
    onCambiar([...fotos, ...nuevas])
  }

  return (
    <div className="mt-3">
      <p className="etiqueta mb-2">Fotos</p>
      <ul className="grid grid-cols-5 gap-2" aria-label={`Fotos de ${etiqueta}`}>
        {fotos.map((f, i) => (
          <li key={f.key}>
            <button
              type="button"
              className="relative block w-full bg-bone"
              onClick={() => setEditando(f.key)}
              aria-label={`Foto ${i + 1}${i === 0 ? ', principal' : ''}: ajustar o quitar`}
            >
              <img src={f.vista} alt="" className="aspect-[4/5] w-full object-cover" />
              {i === 0 && <span className="absolute inset-x-0 bottom-0 bg-paper/80 py-0.5 text-center text-xs">Principal</span>}
            </button>
          </li>
        ))}
        {Array.from({ length: procesando }, (_, i) => (
          <li key={`p${i}`} aria-label="Procesando foto" className="aspect-[4/5] animate-pulse bg-bone" />
        ))}
        {libres - procesando > 0 && (
          <li>
            <label className="grid aspect-[4/5] cursor-pointer place-items-center border border-dashed border-graphite text-graphite transition duration-300 ease-base hover:border-ink hover:text-ink has-focus-visible:outline-2 has-focus-visible:outline-cobalt">
              <span className="grid place-items-center gap-1 text-xs">
                <span className="text-xl leading-none" aria-hidden="true">
                  +
                </span>
                Foto
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={elegir}
                disabled={procesando > 0}
                aria-label={`Agregar fotos de ${etiqueta}`}
                aria-describedby={errorId}
              />
            </label>
          </li>
        )}
      </ul>
      {procesando > 0 && <p className="mt-2 text-xs text-graphite">Mejorando y comprimiendo las fotos…</p>}
      {aviso && <p className="mt-2 text-sm text-red-700">{aviso}</p>}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {foto && (
        <EditorFoto
          key={foto.key}
          foto={foto}
          esPrincipal={fotos[0] === foto}
          onCerrar={() => setEditando(null)}
          onListo={(nueva) => {
            onCambiar(fotos.map((f) => (f.key === nueva.key ? nueva : f)))
            setEditando(null)
          }}
          onPrincipal={() => {
            onCambiar([foto, ...fotos.filter((f) => f !== foto)])
            setEditando(null)
          }}
          onQuitar={() => {
            if (foto.nueva) URL.revokeObjectURL(foto.vista)
            onCambiar(fotos.filter((f) => f !== foto))
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Vista previa grande de la foto mejorada (SRS 3.4.3.5), con mejora y recorte a 4:5 opcionales.
 * El recorte se muestra con CSS mientras se mueve el control; la foto se reprocesa al tocar «Listo».
 * Las fotos ya subidas no tienen el original: solo se pueden hacer principales o quitar.
 */
function EditorFoto(props: {
  foto: FotoForm
  esPrincipal: boolean
  onCerrar: () => void
  onListo: (f: FotoForm) => void
  onPrincipal: () => void
  onQuitar: () => void
}) {
  const { foto } = props
  const nueva = foto.nueva
  const dialogo = useRef<HTMLDialogElement>(null)
  const [mejorar, setMejorar] = useState(nueva?.mejorar ?? true)
  const [recortar, setRecortar] = useState(nueva?.recorte != null)
  const [posicion, setPosicion] = useState(nueva?.recorte ?? 0.5)
  const [base, setBase] = useState('') // detalle sin recorte, para la vista previa
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogo.current?.showModal()
  }, [])

  useEffect(() => {
    if (!nueva) return
    let url = ''
    let vigente = true
    procesarFoto(nueva.original, { mejorar, recorte: null })
      .then((r) => {
        if (!vigente) return
        url = URL.createObjectURL(r.detalle)
        setBase(url)
      })
      .catch((err) => vigente && setError(mensaje(err)))
    return () => {
      vigente = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [nueva, mejorar])

  const src = nueva ? base : supabase.storage.from('fotos').getPublicUrl(foto.path!).data.publicUrl

  async function listo() {
    const recorte = recortar ? posicion : null
    if (!nueva || (mejorar === nueva.mejorar && recorte === nueva.recorte)) return props.onCerrar()
    setOcupado(true)
    try {
      const r = await procesarFoto(nueva.original, { mejorar, recorte })
      URL.revokeObjectURL(foto.vista)
      props.onListo({ ...foto, vista: URL.createObjectURL(r.grilla), nueva: { ...nueva, ...r, mejorar, recorte } })
    } catch (err) {
      setError(mensaje(err))
      setOcupado(false)
    }
  }

  return (
    <dialog
      ref={dialogo}
      onCancel={(e) => {
        e.preventDefault()
        props.onCerrar()
      }}
      aria-label="Ajustar foto"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-paper text-ink backdrop:bg-ink/60 md:m-auto md:h-auto md:max-h-[90dvh] md:max-w-lg"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-bone px-4 py-2">
          <h3 className="text-lg font-semibold">Ajustar foto</h3>
          <button type="button" className="grid size-11 place-items-center hover:bg-bone" onClick={props.onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-bone p-4">
          {!src ? (
            <div aria-label="Cargando vista previa" className="aspect-[4/5] w-full max-w-xs animate-pulse bg-paper/60" />
          ) : recortar ? (
            <img
              src={src}
              alt="Vista previa con recorte"
              className="aspect-[4/5] w-full max-w-xs object-cover"
              style={{ objectPosition: `${posicion * 100}% ${posicion * 100}%` }}
            />
          ) : (
            <img src={src} alt="Vista previa" className="max-h-[55dvh] max-w-full object-contain" />
          )}
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          {nueva && (
            <>
              <div className="flex flex-wrap gap-2">
                <label className="chip has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-cobalt">
                  <input type="checkbox" className="sr-only" checked={mejorar} onChange={(e) => setMejorar(e.target.checked)} />
                  Mejorar contraste y nitidez
                </label>
                <label className="chip has-checked:bg-ink has-checked:text-paper has-focus-visible:outline-2 has-focus-visible:outline-cobalt">
                  <input type="checkbox" className="sr-only" checked={recortar} onChange={(e) => setRecortar(e.target.checked)} />
                  Recortar a 4:5
                </label>
              </div>
              {recortar && (
                <label className="block">
                  <span className="etiqueta mb-2 block">Posición del recorte</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={posicion}
                    onChange={(e) => setPosicion(Number(e.target.value))}
                    className="h-11 w-full accent-ink"
                  />
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="boton border-red-700 text-red-700" onClick={props.onQuitar}>
              Quitar
            </button>
            {!props.esPrincipal && (
              <button type="button" className="boton" onClick={props.onPrincipal}>
                Hacer principal
              </button>
            )}
            <button type="button" className="boton flex-1" onClick={listo} disabled={ocupado}>
              {ocupado ? 'Procesando' : 'Listo'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
