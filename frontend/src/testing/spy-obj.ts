import { vi } from 'vitest';

/**
 * Equivalente a `jasmine.createSpyObj` sobre Vitest, en sus **tres formas reales de uso** — las que
 * aparecen en este repositorio, no las que yo suponía:
 *
 *   createSpyObj<T>('Nombre', { metodo: valorDeRetorno })     ← métodos con su retorno
 *   createSpyObj<T>('Nombre', ['metodo', 'otro'])             ← solo nombres, retorno undefined
 *   createSpyObj<T>('Nombre', ['metodo'], { url: '/clients' }) ← métodos + propiedades planas
 *
 * ── POR QUÉ EXISTE, EN VEZ DE REESCRIBIR CADA SPEC ──────────────────────────────────────────────
 * La migración de Karma a Vitest solo tropieza con un puñado de APIs de Jasmine, y esta aparece en
 * casi todas las llamadas. Reescribir cada una cambia decenas de líneas de pruebas que hoy funcionan
 * y que nadie está tocando por otro motivo — más superficie para equivocarse que ganancia.
 *
 * El primer argumento (el nombre) se conserva aunque no se use: quitarlo obligaría a editar todas
 * las llamadas, que es justo lo que se quiere evitar.
 */
export function createSpyObj<T>(
  _nombre: string,
  metodos: readonly string[] | Record<string, unknown>,
  propiedades: Record<string, unknown> = {},
): T {
  const doble: Record<string, unknown> = {};
  if (Array.isArray(metodos)) {
    for (const clave of metodos) doble[clave] = vi.fn();
  } else {
    for (const [clave, valorDeRetorno] of Object.entries(metodos as Record<string, unknown>)) {
      doble[clave] = vi.fn(() => valorDeRetorno);
    }
  }
  // Las propiedades van tal cual: no son espías, son datos que el doble expone.
  return Object.assign(doble, propiedades) as T;
}
