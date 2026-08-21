// [AI-GENERATED | WI: WI-API-CLIENTES-FAV-001 | spec: MEAN-UX-CLIENTES-FAV-001 | contrato: MEAN-API-CLIENTES-FAV-001]
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import type { ClientSummary } from '../models/client.model';

/**
 * El contrato del dominio para la relación favorito por usuario.
 *
 * Puerto SEPARADO de `ClientRepositoryPort` (no un método más ahí): la relación favorito tiene su
 * propio ciclo de vida y no es una propiedad del cliente — mismo principio que llevó a separar
 * `FavoriteService` de `ClientService` en el backend (ARCH-001/ARCH-002 de
 * MEAN-API-CLIENTES-FAV-001).
 */
export interface FavoriteRepositoryPort {
  mark(clientId: string): Observable<void>;
  unmark(clientId: string): Observable<void>;
  /** Los clientes favoritos del usuario autenticado, ya ofuscados y listos para pintar. */
  listFavoriteClients(): Observable<ClientSummary[]>;
}

export const FAVORITE_REPOSITORY = new InjectionToken<FavoriteRepositoryPort>(
  'FAVORITE_REPOSITORY',
);
