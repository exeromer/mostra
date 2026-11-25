import type { ComponentProps } from 'react'
import { Enlace } from '../lib/ruta'

// Íconos de trazo fino (1 px), como pide DESIGN.md.
const TRAZOS = {
  arriba: 'M3 10l5-5 5 5',
  abajo: 'M3 6l5 5 5-5',
  editar: 'M10.5 2.5l3 3L5 14H2v-3z',
  borrar: 'M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4',
  ver: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 100-4 2 2 0 000 4z',
  oculto: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8zM8 10a2 2 0 100-4 2 2 0 000 4zM2 2l12 12',
  cerrar: 'M3 3l10 10M13 3L3 13',
}

export type NombreIcono = keyof typeof TRAZOS

export function Icono({ nombre }: { nombre: NombreIcono }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}

const CLASES =
  'grid size-11 shrink-0 place-items-center transition duration-300 ease-base hover:bg-bone active:scale-[0.98] disabled:opacity-20'

/** Botón cuadrado de 44 px con ícono; `etiqueta` es lo que lee el lector de pantalla. */
export function BotonIcono({ icono, etiqueta, ...props }: ComponentProps<'button'> & { icono: NombreIcono; etiqueta: string }) {
  return (
    <button type="button" aria-label={etiqueta} title={etiqueta} className={CLASES} {...props}>
      <Icono nombre={icono} />
    </button>
  )
}

export function EnlaceIcono({ icono, etiqueta, href }: { icono: NombreIcono; etiqueta: string; href: string }) {
  return (
    <Enlace href={href} aria-label={etiqueta} title={etiqueta} className={CLASES}>
      <Icono nombre={icono} />
    </Enlace>
  )
}

/** Fila de confirmación para borrar: pide un segundo toque explícito. */
export function ConfirmarBorrado(props: { texto: string; detalle?: string; ocupado: boolean; onCancelar: () => void; onBorrar: () => void }) {
  return (
    <div role="alertdialog" aria-label={props.texto} className="py-3">
      <p className="text-base">{props.texto}</p>
      {props.detalle && <p className="mt-1 text-sm text-graphite">{props.detalle}</p>}
      <div className="mt-3 flex gap-3">
        <button type="button" className="boton flex-1" onClick={props.onCancelar} autoFocus>
          Cancelar
        </button>
        <button type="button" className="boton flex-1 border-red-700 text-red-700" onClick={props.onBorrar} disabled={props.ocupado}>
          {props.ocupado ? 'Eliminando' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}
