import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sumarTalles, validarProducto, type ProductoForm } from './producto.ts'

const valido: ProductoForm = {
  nombre: 'Remera lisa',
  descripcion: '',
  precio: '12500',
  categoria_id: 'c1',
  genero: 'unisex',
  colores: [{ key: 'a', nombre: 'Negro', talles: [{ talle: 'M', sin_stock: false }], fotos: [{ key: 'f', path: 'x.webp', vista: '' }] }],
}

test('validarProducto', () => {
  assert.deepEqual(validarProducto(valido), {})
  assert.deepEqual(Object.keys(validarProducto({ ...valido, nombre: ' ', precio: '0', genero: '', colores: [] })), [
    'nombre',
    'precio',
    'genero',
    'colores',
  ])
  assert.ok(validarProducto({ ...valido, precio: '12.500' }).precio)
  const repetido = { key: 'b', nombre: 'negro ', talles: [], fotos: [] }
  const e = validarProducto({ ...valido, colores: [...valido.colores, repetido] })
  assert.equal(e['b.nombre'], 'Ese color ya está cargado.')
  assert.ok(e['b.talles'])
  assert.equal(e['b.fotos'], 'Agregá al menos una foto.')
  const seis = Array.from({ length: 6 }, (_, i) => ({ key: `f${i}`, path: `${i}.webp`, vista: '' }))
  assert.ok(validarProducto({ ...valido, colores: [{ ...valido.colores[0], fotos: seis }] })['a.fotos'])
})

test('sumarTalles', () => {
  const r = sumarTalles([{ talle: 'M', sin_stock: true }], ['S', 'm', 'L', 'S', ' '])
  assert.deepEqual(
    r.map((t) => t.talle),
    ['M', 'S', 'L'],
  )
  assert.equal(r[0].sin_stock, true)
})
