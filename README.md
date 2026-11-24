# Mostra

Catálogo web de ropa para vendedores de Instagram y WhatsApp: cada tienda tiene su link, el comprador arma un carrito y el pedido llega ordenado por WhatsApp.

## Stack

- Vite + React + TypeScript + Tailwind CSS
- Supabase: Postgres con RLS por tienda, Auth con Google y Storage
- Cloudflare Pages (`public/_redirects` sirve la SPA en todas las rutas)

## Arranque

```bash
npm install
cp .env.example .env.local   # completar con los datos del proyecto de Supabase
npm run dev
```

Las migraciones de la base van en `supabase/migrations` (`npx supabase migration new <nombre>`).
