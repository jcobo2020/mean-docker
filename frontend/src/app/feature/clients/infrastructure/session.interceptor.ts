// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * El interceptor de sesión del módulo Clients.
 *
 * ALCANCE: se registra en el enrutado con carga diferida del módulo (ver `clients.routes.ts`), NO
 * en la raíz de la aplicación. Registrarlo globalmente cambiaría el comportamiento de las llamadas
 * de User y Contact, que hoy no limpian sesión ni distinguen 401 de 403 — y este work item declara
 * expresamente que no toca esos módulos.
 *
 * LA DISTINCIÓN QUE JUSTIFICA QUE EXISTA: el 401 significa que la sesión ya no vale, y expulsa. El
 * 403 significa que la sesión es válida pero el rol no alcanza, y NO expulsa: lo muestra la pantalla
 * en su sitio. Confundirlos —que es lo que ocurre cuando solo se mira «es un 4xx»— saca de la sesión
 * a quien simplemente no tenía permiso para una acción concreta.
 *
 * LO QUE NO HACE, y es tan importante como lo que hace: no toca 400, 403, 404 ni 409. Esos son
 * específicos de cada pantalla y llegan intactos al adaptador, que los convierte en errores de
 * dominio. Un interceptor que se los tragara convertiría el 409 de correo duplicado en un aviso
 * genérico, que es justo lo que el contrato pide evitar.
 */
export const clientsSessionInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // Limpiar ANTES de navegar no es cosmético: un token caducado que siga en almacenamiento
        // vuelve a viajar en la siguiente petición y produce un bucle de expulsiones.
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentUser');
        }
        router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }
      // Todo lo demás sigue su camino SIN transformarse: el adaptador necesita el
      // `HttpErrorResponse` entero para traducirlo a su error de dominio.
      return throwError(() => error);
    }),
  );
};
