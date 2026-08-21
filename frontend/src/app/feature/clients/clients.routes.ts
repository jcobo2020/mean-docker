// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Routes } from '@angular/router';
import { authGuard } from '../../@core/guards';
import { jwtInterceptor } from '../../@core/interceptors/jwtToken.Interceptor';
import { ListClientsUseCase } from './application/client.use-cases';
import {
  ListFavoriteClientsUseCase,
  MarkFavoriteUseCase,
  UnmarkFavoriteUseCase,
} from './application/favorite.use-cases';
import { CLIENT_REPOSITORY } from './domain/ports/client-repository.port';
import { FAVORITE_REPOSITORY } from './domain/ports/favorite-repository.port';
import { HttpClientRepository } from './infrastructure/http-client.repository';
import { HttpFavoriteRepository } from './infrastructure/http-favorite.repository';
import { clientsSessionInterceptor } from './infrastructure/session.interceptor';

/**
 * El enrutado del módulo Clients, y la ÚNICA cosa que el módulo expone al resto de la aplicación.
 *
 * ── EL `HttpClient` PROPIO, Y POR QUÉ NO ES UN CAPRICHO ─────────────────────────────────────────
 *
 * `provideHttpClient` aquí crea una instancia de `HttpClient` para el subárbol de este enrutado,
 * separada de la raíz. Es API documentada de Angular: los *environment providers* van en
 * `bootstrapApplication` para toda la app, o en el `providers` de una ruta para acotarlos.
 *
 * Hacía falta por un motivo MEDIDO, no por purismo: el `errorInterceptor` global de la aplicación
 * convierte cualquier `HttpErrorResponse` en un **string** antes de devolverlo. Usando el
 * `HttpClient` de la raíz, el adaptador de este módulo recibiría texto y no podría traducir 404,
 * 409, 403 ni 400 a sus errores de dominio: todos caerían en «error de infraestructura» y el 409 de
 * correo duplicado acabaría como aviso genérico. Y quitar el interceptor global no era opción: lo
 * usan User y Contact, que este work item declara no tocar.
 *
 * Se conserva `jwtInterceptor` porque el token sí hace falta; se sustituye `errorInterceptor` por
 * `clientsSessionInterceptor`, que distingue 401 de 403 y deja pasar el resto sin transformar.
 *
 * ── ORDEN DE LAS RUTAS: RESTRICCIÓN, NO PREFERENCIA ────────────────────────────────────────────
 *
 * `new` va ANTES que `:id`. Si se declarara al revés, el router resolvería «new» como identificador,
 * activaría el detalle con id='new' y pediría `GET /api/clients/new`, que el contrato responde con
 * 400. Es invisible al compilar y evidente al usar, y la única defensa es el orden — cubierto por
 * la prueba de enrutado de `clients.routes.spec.ts`.
 */
const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    providers: [
      provideHttpClient(withInterceptors([jwtInterceptor, clientsSessionInterceptor])),
      { provide: CLIENT_REPOSITORY, useClass: HttpClientRepository },
      { provide: FAVORITE_REPOSITORY, useClass: HttpFavoriteRepository },
      ListClientsUseCase,
      MarkFavoriteUseCase,
      UnmarkFavoriteUseCase,
      ListFavoriteClientsUseCase,
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./ui/client-list/client-list.component').then((m) => m.ClientListComponent),
      },
      // ⚠️ `new` antes que `:id`. Ver la explicación de arriba antes de reordenar.
      // Las pantallas /contacts/new y /contacts/:id son de OTROS work items del mismo paquete
      // (WI-CLI-FRONT-003 y WI-CLI-FRONT-002) y se añadirán aquí, en este orden.
    ],
  },
];

export default routes;
