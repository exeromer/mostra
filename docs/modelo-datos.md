# Modelo de datos de Mostra (3FN)

Diseño acordado para la primera migración (`supabase/migrations/<timestamp>_esquema_inicial.sql`).
Fuente funcional: SRS v1.0, sección 3.4 (módulos 3.4.1 a 3.4.8).

## Tablas

Todas las PK son `uuid default gen_random_uuid()`. Todas las tablas llevan `created_at timestamptz default now()`.

| Tabla | Columnas | Claves y restricciones |
|---|---|---|
| `tienda` | `owner_id`, `slug`, `nombre`, `whatsapp`, `logo_path` | `owner_id` FK `auth.users` **unique** (un vendedor = una tienda). `slug` unique, `^[a-z0-9]+(-[a-z0-9]+)*$`, 3 a 40 caracteres, distinto de `admin`, `login`, `panel`, `api`. `nombre` 1 a 60. `whatsapp` `^549[0-9]{10}$`. `logo_path` null |
| `categoria` | `tienda_id`, `nombre`, `orden` | FK `tienda` on delete cascade. `unique (tienda_id, nombre)`. `nombre` 1 a 40 |
| `producto` | `categoria_id`, `nombre`, `descripcion`, `precio`, `genero`, `visible` | FK `categoria` **on delete restrict** (3.4.2.2). `nombre` 1 a 80. `descripcion` null, hasta 300. `precio integer > 0` (pesos). `visible boolean default true` |
| `producto_color` | `producto_id`, `nombre`, `orden` | FK `producto` on delete cascade. `unique (producto_id, nombre)`. `nombre` 1 a 30 |
| `color_foto` | `color_id`, `path`, `orden` | FK `producto_color` on delete cascade. `path` único. Máximo 5 por color (trigger) |
| `color_talle` | `color_id`, `talle`, `sin_stock`, `orden` | FK `producto_color` on delete cascade. `unique (color_id, talle)`. `talle` 1 a 10. `sin_stock boolean default false` |

`genero` es un tipo enum: `create type genero as enum ('hombre','mujer','nino','nina','unisex')`. La interfaz muestra «Niño» y «Niña».

Índices: uno por cada FK (`categoria.tienda_id`, `producto.categoria_id`, `producto_color.producto_id`, `color_foto.color_id`, `color_talle.color_id`).

## Por qué está en 3FN

- **1FN:** sin listas en columnas. Los colores, fotos y talles son filas, no arrays.
- **2FN:** cada tabla tiene PK de una sola columna, así que no hay dependencias parciales. Las claves naturales quedan como `unique`.
- **3FN:** ninguna columna depende de otra que no sea la clave.
  - `tienda_id` está **solo en `categoria`**. La tienda de un producto se obtiene por su categoría, y la de un color, una foto o un talle, por su producto. Repetir `tienda_id` en las tablas hijas sería una dependencia transitiva.
  - No se guardan datos derivados:
    - si una categoría se ve en el catálogo (tiene productos visibles);
    - si un producto está sin stock (todos sus talles marcados);
    - la ruta de la miniatura (convención de nombre, ver Storage);
    - los totales del carrito.

Alternativa descartada: repetir `tienda_id` en todas las tablas con FK compuestas `(id, tienda_id)`. Simplifica las reglas RLS, pero rompe la 3FN. Con catálogos de decenas de productos, los joins en las reglas no tienen costo apreciable.

## Aislamiento por tienda (RLS)

RLS activado en todas las tablas. Funciones auxiliares `security definer`, `stable`, con `search_path` fijo:

- `mi_tienda_id()`: id de la tienda cuyo `owner_id = auth.uid()`.
- `tienda_de_producto(producto_id)` y `tienda_de_color(color_id)`: suben por las FK hasta `categoria.tienda_id`.

| Tabla | Lectura pública (anon) | Escritura (solo el dueño) |
|---|---|---|
| `tienda` | todas | `owner_id = auth.uid()` |
| `categoria` | todas (el front oculta las vacías) | `tienda_id = mi_tienda_id()` |
| `producto` | `visible = true`, o el dueño ve todo | la categoría (`categoria_id`) es de `mi_tienda_id()`; así también se valida al insertar y al cambiar de categoría |
| `producto_color` | si el producto padre es visible, o el dueño | `tienda_de_producto(producto_id) = mi_tienda_id()` |
| `color_foto`, `color_talle` | si el producto padre es visible, o el dueño | `tienda_de_color(color_id) = mi_tienda_id()` |

Las reglas de escritura siempre miran la FK del padre, nunca el `id` propio, para que funcionen también en el `insert`.

Escribir la política de `insert` con `with check`, y la de `update` con `using` y `with check`, para impedir mover filas a otra tienda.

## Triggers

- `after insert on tienda`: crea las categorías base en este orden: Remeras, Camisas, Buzos, Camperas, Pantalones, Jeans, Vestidos, Polleras, Zapatos, Bolsos, Sombreros, Accesorios, Niños/Infante (3.4.1.3).
- `before insert on color_foto`: rechaza la sexta foto de un color (3.4.3.2.2).

## Storage

- **Bucket:** `fotos`, público para lectura, con límite de 200 KB por archivo y solo `image/webp`.
- **Ruta:** `{tienda_id}/{producto_id}/{color_id}/{uuid}.webp` para el detalle y `{uuid}_g.webp` para la grilla. `color_foto.path` guarda solo la del detalle; la de la grilla sale por convención.
- **Políticas:** insert, update y delete solo si la primera carpeta es igual a `mi_tienda_id()::text`.
- **Logo:** `{tienda_id}/logo.webp`.
- Al eliminar un producto, la base borra sus filas en cascada. Los archivos de Storage los borra el front (3.4.5.5).

## Fuera de esta migración

- `ia_uso (tienda_id, dia, usos)` para limitar la IA por día (3.4.4.5). Se agrega con la Edge Function de IA.
- El carrito no va a la base: vive en `localStorage`, separado por slug (3.4.7.3).
