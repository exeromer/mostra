// Fotos en el navegador con canvas (Sharp no corre en este stack). Ver CLAUDE.md.

export type OpcionesFoto = {
  mejorar: boolean
  /** Recorte a 4:5 (la proporción de la grilla): posición del corte de 0 a 1; null = sin recortar. */
  recorte: number | null
}

export const PROPORCION = 4 / 5

/** Ruta de la versión de grilla a partir de la del detalle: "a/b/c.webp" → "a/b/c_g.webp". */
export const rutaGrilla = (ruta: string) => ruta.replace(/\.(\w+)$/, '_g.$1')

export const extension = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')

/**
 * Estira los niveles: el 1% más oscuro pasa a negro y el 1% más claro a blanco.
 * El mismo ajuste en los tres canales, para no cambiar el color de la prenda.
 */
export function estirarContraste(px: Uint8ClampedArray) {
  const histo = new Uint32Array(256)
  for (let i = 0; i < px.length; i += 4) histo[(px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8]++
  const total = px.length / 4
  let acumulado = 0
  let bajo = 0
  while (bajo < 255 && (acumulado += histo[bajo]) < total * 0.01) bajo++
  acumulado = 0
  let alto = 255
  while (alto > 0 && (acumulado += histo[alto]) < total * 0.01) alto--
  if (alto - bajo < 32 || (bajo === 0 && alto === 255)) return // ya tiene rango completo, o es casi lisa
  const tabla = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v++) tabla[v] = ((v - bajo) * 255) / (alto - bajo)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = tabla[px[i]]
    px[i + 1] = tabla[px[i + 1]]
    px[i + 2] = tabla[px[i + 2]]
  }
}

/** Enfoque suave (máscara de enfoque 3×3). No toca los bordes de la imagen. */
export function enfocar(px: Uint8ClampedArray, ancho: number, alto: number, cantidad = 0.35) {
  const fuente = px.slice()
  const fila = ancho * 4
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * fila + x * 4
      for (let c = 0; c < 3; c++) {
        const centro = fuente[i + c]
        const vecinos = fuente[i + c - 4] + fuente[i + c + 4] + fuente[i + c - fila] + fuente[i + c + fila]
        px[i + c] = centro + cantidad * (4 * centro - vecinos)
      }
    }
  }
}

function dibujar(fuente: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, maxLado: number) {
  const escala = Math.min(1, maxLado / Math.max(sw, sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sw * escala)
  canvas.height = Math.round(sh * escala)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fuente, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Comprime a WebP bajando la calidad hasta entrar en maxBytes.
 * Si el navegador no genera WebP (Safari en iPhone, por ejemplo), usa JPEG.
 */
async function aArchivo(canvas: HTMLCanvasElement, maxBytes: number) {
  for (const tipo of ['image/webp', 'image/jpeg']) {
    for (const calidad of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, calidad))
      if (blob?.type !== tipo) break // este navegador no genera este formato
      if (blob.size <= maxBytes) return blob
    }
  }
  throw new Error('La imagen pesa demasiado incluso comprimida. Probá con otra.')
}

/** Logo u otra imagen suelta: achicar y comprimir, sin mejora. */
export async function comprimirImagen(archivo: File, maxLado: number, maxBytes: number) {
  const img = await createImageBitmap(archivo)
  return aArchivo(dibujar(img, 0, 0, img.width, img.height, maxLado), maxBytes)
}

/** Foto de producto: recorte opcional, mejora y dos tamaños (detalle 1200 px / 200 KB, grilla 400 px / 50 KB). */
export async function procesarFoto(archivo: File, { mejorar, recorte }: OpcionesFoto) {
  const img = await createImageBitmap(archivo)
  let [sx, sy, sw, sh] = [0, 0, img.width, img.height]
  if (recorte !== null) {
    if (sw / sh > PROPORCION) {
      const w = Math.round(sh * PROPORCION)
      sx = Math.round((sw - w) * recorte)
      sw = w
    } else {
      const h = Math.round(sw / PROPORCION)
      sy = Math.round((sh - h) * recorte)
      sh = h
    }
  }
  const detalle = dibujar(img, sx, sy, sw, sh, 1200)
  if (mejorar) {
    const ctx = detalle.getContext('2d')!
    const datos = ctx.getImageData(0, 0, detalle.width, detalle.height)
    estirarContraste(datos.data)
    enfocar(datos.data, detalle.width, detalle.height)
    ctx.putImageData(datos, 0, 0)
  }
  const grilla = dibujar(detalle, 0, 0, detalle.width, detalle.height, 400)
  return { detalle: await aArchivo(detalle, 200_000), grilla: await aArchivo(grilla, 50_000) }
}
