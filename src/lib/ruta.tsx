import { useSyncExternalStore, type ComponentProps } from 'react'

// Ruteo mínimo con la History API: pocas rutas, sin dependencia.
// ponytail: si aparecen rutas con muchos parámetros o carga diferida, pasar a React Router.

function suscribir(avisar: () => void) {
  addEventListener('popstate', avisar)
  return () => removeEventListener('popstate', avisar)
}

/** Ruta actual sin barra final ("/panel/categorias"; la raíz es "/"). */
export function useRuta() {
  return useSyncExternalStore(suscribir, () => location.pathname.replace(/\/+$/, '') || '/')
}

export function ir(ruta: string, { reemplazar = false } = {}) {
  history[reemplazar ? 'replaceState' : 'pushState'](null, '', ruta)
  dispatchEvent(new PopStateEvent('popstate'))
  if (!reemplazar) scrollTo(0, 0)
}

/** <a> que navega sin recargar; Ctrl/Cmd + clic sigue abriendo otra pestaña. */
export function Enlace(props: ComponentProps<'a'> & { href: string }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        props.onClick?.(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        ir(props.href)
      }}
    />
  )
}
