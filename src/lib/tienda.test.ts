import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aSlug, aWhatsapp, errorSlug } from './tienda.ts'

test('aSlug', () => {
  assert.equal(aSlug('  Ropa de Ñandú!! '), 'ropa-de-nandu')
  assert.equal(aSlug('Niños & Niñas 2026'), 'ninos-ninas-2026')
  assert.equal(aSlug('a'.repeat(39) + ' b'), 'a'.repeat(39))
})

test('errorSlug', () => {
  assert.equal(errorSlug('mi-tienda'), null)
  assert.ok(errorSlug('ab'))
  assert.ok(errorSlug('mi--tienda'))
  assert.ok(errorSlug('-mitienda'))
  assert.ok(errorSlug('Mitienda'))
  assert.ok(errorSlug('panel'))
})

test('aWhatsapp', () => {
  assert.equal(aWhatsapp('11 2345-6789'), '5491123456789')
  assert.equal(aWhatsapp('011 2345 6789'), '5491123456789')
  assert.equal(aWhatsapp('+54 9 351 234 5678'), '5493512345678')
  assert.equal(aWhatsapp('54 351 234 5678'), '5493512345678')
  assert.equal(aWhatsapp('011 15 2345 6789'), null)
  assert.equal(aWhatsapp('2345678'), null)
})
