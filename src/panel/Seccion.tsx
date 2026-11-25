import type { ReactNode } from 'react'

/** Título a la izquierda y contenido a la derecha desde tablet; apilados en el celular. */
export function Seccion({ titulo, bajada, children }: { titulo: ReactNode; bajada: string; children: ReactNode }) {
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

/** Esqueleto de carga con la misma grilla que Seccion. */
export function Esqueleto({ filas = 2 }: { filas?: number }) {
  return (
    <div aria-label="Cargando" className="grid animate-pulse gap-8 md:grid-cols-12">
      <div className="md:col-span-5 lg:col-span-4">
        <div className="h-8 w-48 bg-bone md:h-10" />
        <div className="mt-3 h-4 w-64 max-w-full bg-bone" />
      </div>
      <div className="flex flex-col gap-3 md:col-span-7 lg:col-span-6 lg:col-start-6">
        {Array.from({ length: filas }, (_, i) => (
          <div key={i} className="h-11 bg-bone" />
        ))}
      </div>
    </div>
  )
}
