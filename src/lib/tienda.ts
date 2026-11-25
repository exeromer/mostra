export type Tienda = {
  id: string
  owner_id: string
  slug: string
  nombre: string
  whatsapp: string
  logo_path: string | null
}

const RESERVADAS = ['admin', 'login', 'panel', 'api']

/** "Ropa de Ñandú" → "ropa-de-nandu" */
export function aSlug(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '')
}

/** Las mismas reglas que el check de la base; null si es válido. */
export function errorSlug(slug: string) {
  if (slug.length < 3 || slug.length > 40) return 'El link tiene que tener entre 3 y 40 caracteres.'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Usá solo minúsculas, números y guiones entre palabras.'
  if (RESERVADAS.includes(slug)) return 'Ese link está reservado.'
  return null
}

/**
 * Lo que escribe el vendedor ("011 2345-6789", "+54 9 11 2345 6789") → "5491123456789".
 * null si no quedan 10 dígitos (código de área sin 0 + número sin 15).
 */
export function aWhatsapp(texto: string) {
  let d = texto.replace(/\D/g, '')
  if (d.startsWith('549')) d = d.slice(3)
  else if (d.startsWith('54')) d = d.slice(2)
  d = d.replace(/^0/, '')
  return d.length === 10 ? '549' + d : null
}
