export const GENEROS = [
  { valor: 'hombre', nombre: 'Hombre' },
  { valor: 'mujer', nombre: 'Mujer' },
  { valor: 'nino', nombre: 'Niño' },
  { valor: 'nina', nombre: 'Niña' },
  { valor: 'unisex', nombre: 'Unisex' },
] as const

export type Genero = (typeof GENEROS)[number]['valor']

/** Listas rápidas de talles (SRS 3.4.3.2.3). */
export const TALLES_RAPIDOS = [
  { nombre: 'S a XXL', talles: ['S', 'M', 'L', 'XL', 'XXL'] },
  { nombre: '36 a 46', talles: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'] },
  { nombre: '2 a 16', talles: ['2', '4', '6', '8', '10', '12', '14', '16'] },
  { nombre: 'Único', talles: ['Único'] },
]

export type TalleForm = { talle: string; sin_stock: boolean }
/** key: identificador estable para React; id: el de la base, si el color ya existe. */
export type ColorForm = { key: string; id?: string; nombre: string; talles: TalleForm[] }
export type ProductoForm = {
  nombre: string
  descripcion: string
  precio: string // solo dígitos
  categoria_id: string
  genero: Genero | ''
  colores: ColorForm[]
}

export const formatoPrecio = (pesos: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(pesos)

/** Suma talles sin repetir (compara sin mayúsculas). */
export function sumarTalles(actuales: TalleForm[], nuevos: string[]) {
  const usados = new Set(actuales.map((t) => t.talle.toLowerCase()))
  const extra = nuevos
    .map((t) => t.trim())
    .filter((t) => t && !usados.has(t.toLowerCase()) && usados.add(t.toLowerCase()))
  return [...actuales, ...extra.map((talle) => ({ talle, sin_stock: false }))]
}

/**
 * Las reglas del SRS 3.4.3 y de la base. Claves: nombre, descripcion, precio, categoria, genero,
 * colores, y por color `${key}.nombre` / `${key}.talles`. Vacío = válido.
 * ponytail: la foto obligatoria por color se valida con la carga de fotos (paso 3b).
 */
export function validarProducto(p: ProductoForm) {
  const e: Record<string, string> = {}
  const nombre = p.nombre.trim()
  if (!nombre) e.nombre = 'Escribí el nombre del producto.'
  else if (nombre.length > 80) e.nombre = 'Hasta 80 caracteres.'
  if (p.descripcion.trim().length > 300) e.descripcion = 'Hasta 300 caracteres.'
  if (!/^[1-9]\d{0,8}$/.test(p.precio)) e.precio = 'Poné un precio en pesos, sin centavos.'
  if (!p.categoria_id) e.categoria = 'Elegí una categoría.'
  if (!p.genero) e.genero = 'Elegí para quién es.'
  if (!p.colores.length) e.colores = 'Agregá al menos un color.'

  const colores = new Set<string>()
  for (const c of p.colores) {
    const n = c.nombre.trim()
    if (!n) e[`${c.key}.nombre`] = 'Escribí el nombre del color.'
    else if (n.length > 30) e[`${c.key}.nombre`] = 'Hasta 30 caracteres.'
    else if (colores.has(n.toLowerCase())) e[`${c.key}.nombre`] = 'Ese color ya está cargado.'
    colores.add(n.toLowerCase())

    if (!c.talles.length) e[`${c.key}.talles`] = 'Agregá al menos un talle.'
    else if (c.talles.some((t) => t.talle.length > 10)) e[`${c.key}.talles`] = 'Cada talle tiene hasta 10 caracteres.'
  }
  return e
}
