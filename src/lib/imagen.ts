/**
 * Achica la imagen a maxLado px y la pasa a WebP, bajando la calidad hasta que pese maxBytes o menos.
 * ponytail: sin mejora de contraste ni nitidez todavía; se suma con la carga de fotos de producto (SRS 3.4.3.4).
 */
export async function comprimirWebp(archivo: File, maxLado: number, maxBytes: number) {
  const img = await createImageBitmap(archivo)
  const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)

  for (const calidad of [0.9, 0.75, 0.6, 0.45, 0.3]) {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/webp', calidad))
    if (blob?.type !== 'image/webp') throw new Error('Este navegador no puede convertir la imagen. Probá desde Chrome.')
    if (blob.size <= maxBytes) return blob
  }
  throw new Error('La imagen pesa demasiado incluso comprimida. Probá con otra.')
}
