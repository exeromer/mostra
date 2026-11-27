import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enfocar, estirarContraste, rutaGrilla } from './imagen.ts'

/** Imagen gris de n píxeles con valores dados (r = g = b). */
const gris = (valores: number[]) => new Uint8ClampedArray(valores.flatMap((v) => [v, v, v, 255]))

test('estirarContraste lleva el rango a 0..255', () => {
  const px = gris([...Array(50).fill(60), ...Array(50).fill(180)])
  estirarContraste(px)
  assert.equal(px[0], 0)
  assert.equal(px.at(-4), 255)
  assert.equal(px[3], 255, 'no toca el canal alfa')
})

test('estirarContraste no toca una imagen con rango completo ni una lisa', () => {
  const completa = gris([0, 128, 255, 40])
  estirarContraste(completa)
  assert.deepEqual([...completa], [...gris([0, 128, 255, 40])])
  const lisa = gris(Array(10).fill(120))
  estirarContraste(lisa)
  assert.equal(lisa[0], 120)
})

test('enfocar no cambia una zona lisa y realza un punto', () => {
  const lisa = gris(Array(9).fill(100))
  enfocar(lisa, 3, 3)
  assert.equal(lisa[16], 100) // centro
  const punto = gris([100, 100, 100, 100, 150, 100, 100, 100, 100])
  enfocar(punto, 3, 3)
  assert.ok(punto[16] > 150)
})

test('rutaGrilla', () => {
  assert.equal(rutaGrilla('t/p/c/abc.webp'), 't/p/c/abc_g.webp')
  assert.equal(rutaGrilla('t/p/c/abc.jpg'), 't/p/c/abc_g.jpg')
})
