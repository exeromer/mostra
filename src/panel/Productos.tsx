import { useEffect, useState } from 'react'
import { rutaGrilla } from '../lib/imagen'
import { formatoPrecio } from '../lib/producto'
import { Enlace, ir } from '../lib/ruta'
import { supabase } from '../lib/supabase'
import { BotonIcono, ConfirmarBorrado, EnlaceIcono } from './BotonIcono'
import ProductoForm from './ProductoForm'
import { Esqueleto, Seccion } from './Seccion'

type Fila = { id: string; nombre: string; precio: number; visible: boolean; categoria: string }

const ERROR_RED = 'No pudimos guardar el cambio. Revisá la conexión y probá de nuevo.'

/**
 * Lista de productos con ocultar, editar y eliminar, y el panel para cargarlos o editarlos.
 * `abierto`: 'nuevo', el id de un producto, o null si el panel está cerrado (sale de la URL).
 * ponytail: filtro por categoría, stock rápido desde la lista y duplicar llegan con el paso 4 (SRS 3.4.5).
 */
export default function Productos({ tiendaId, abierto }: { tiendaId: string; abierto: string | null }) {
  const [productos, setProductos] = useState<Fila[]>()
  const [categorias, setCategorias] = useState<{ id: string; nombre: string }[]>()
  const [errorCarga, setErrorCarga] = useState('')
  const [aviso, setAviso] = useState('')
  const [recargas, setRecargas] = useState(0)
  const [borrarId, setBorrarId] = useState<string | null>(null)
  const [borrando, setBorrando] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase
        .from('producto')
        .select('id, nombre, precio, visible, categoria!inner(nombre, tienda_id)')
        .eq('categoria.tienda_id', tiendaId)
        .order('created_at', { ascending: false }),
      supabase.from('categoria').select('id, nombre').eq('tienda_id', tiendaId).order('orden').order('created_at'),
    ]).then(([p, c]) => {
      if (p.error || c.error) return setErrorCarga('No pudimos cargar los productos. Revisá la conexión y recargá la página.')
      setProductos(p.data.map((x) => ({ ...x, categoria: (x.categoria as unknown as { nombre: string }).nombre })))
      setCategorias(c.data)
    })
  }, [tiendaId, recargas])

  async function alternarVisible(p: Fila) {
    const visible = !p.visible
    setProductos((l) => l?.map((x) => (x.id === p.id ? { ...x, visible } : x)))
    setAviso('')
    const { error } = await supabase.from('producto').update({ visible }).eq('id', p.id)
    if (error) {
      setAviso(ERROR_RED)
      setProductos((l) => l?.map((x) => (x.id === p.id ? { ...x, visible: p.visible } : x)))
    }
  }

  async function eliminar(p: Fila) {
    setBorrando(true)
    setAviso('')
    // Las rutas de las fotos se leen antes, porque al borrar el producto las filas se van en cascada.
    const { data: fotos } = await supabase
      .from('color_foto')
      .select('path, producto_color!inner(producto_id)')
      .eq('producto_color.producto_id', p.id)
    const { error } = await supabase.from('producto').delete().eq('id', p.id)
    setBorrando(false)
    setBorrarId(null)
    if (error) return setAviso(ERROR_RED)
    setProductos((l) => l?.filter((x) => x.id !== p.id))
    // ponytail: si falla, quedan archivos sueltos en Storage; no afecta al catálogo.
    if (fotos?.length) {
      await supabase.storage.from('fotos').remove(fotos.flatMap((f) => [f.path, rutaGrilla(f.path)]))
    }
  }

  if (errorCarga) {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorCarga}
      </p>
    )
  }
  if (!productos || !categorias) return <Esqueleto filas={4} />

  return (
    <Seccion titulo="Productos" bajada="Cada producto es un modelo: cargá sus colores y, en cada color, sus fotos y talles.">
      {categorias.length === 0 ? (
        <p className="text-sm text-graphite">
          Para cargar productos necesitás al menos una categoría.{' '}
          <Enlace href="/panel/categorias" className="enlace">
            Crear una categoría
          </Enlace>
        </p>
      ) : (
        <Enlace href="/panel/productos/nuevo" className="boton w-full sm:w-auto">
          Nuevo producto
        </Enlace>
      )}

      {aviso && (
        <p role="alert" className="mt-6 text-sm text-red-700">
          {aviso}
        </p>
      )}

      {productos.length === 0 ? (
        <p className="mt-10 text-sm text-graphite">Todavía no cargaste productos.</p>
      ) : (
        <ul className="mt-10 border-t border-bone">
          {productos.map((p) =>
            p.id === borrarId ? (
              <li key={p.id} className="border-b border-bone">
                <ConfirmarBorrado
                  texto={`¿Eliminar ${p.nombre}?`}
                  detalle="Se borran también sus colores, talles y fotos. Esto no se puede deshacer."
                  ocupado={borrando}
                  onCancelar={() => setBorrarId(null)}
                  onBorrar={() => eliminar(p)}
                />
              </li>
            ) : (
              <li key={p.id} className="flex items-center border-b border-bone">
                <Enlace
                  href={`/panel/productos/${p.id}`}
                  className={`flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 hover:text-graphite ${p.visible ? '' : 'text-graphite'}`}
                >
                  <span className="truncate text-base">{p.nombre}</span>
                  <span className="text-xs text-graphite">
                    {formatoPrecio(p.precio)} · {p.categoria}
                    {!p.visible && ' · Oculto'}
                  </span>
                </Enlace>
                <BotonIcono
                  icono={p.visible ? 'ver' : 'oculto'}
                  etiqueta={p.visible ? `Ocultar ${p.nombre} del catálogo` : `Mostrar ${p.nombre} en el catálogo`}
                  aria-pressed={!p.visible}
                  onClick={() => alternarVisible(p)}
                />
                <EnlaceIcono icono="editar" etiqueta={`Editar ${p.nombre}`} href={`/panel/productos/${p.id}`} />
                <BotonIcono icono="borrar" etiqueta={`Eliminar ${p.nombre}`} onClick={() => setBorrarId(p.id)} />
              </li>
            ),
          )}
        </ul>
      )}

      {abierto && (
        <ProductoForm
          key={abierto}
          tiendaId={tiendaId}
          productoId={abierto === 'nuevo' ? null : abierto}
          categorias={categorias}
          onCerrar={() => ir('/panel')}
          onGuardado={() => {
            ir('/panel')
            setRecargas((n) => n + 1)
          }}
        />
      )}
    </Seccion>
  )
}
