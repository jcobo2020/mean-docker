// [AI-GENERATED | WI: WI-API-CLIENTES-FAV-001 | spec: MEAN-UX-CLIENTES-FAV-001 | contrato: MEAN-API-CLIENTES-FAV-001]
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { FavoriteRepositoryPort } from '../domain/ports/favorite-repository.port';
import type { ClientSummary } from '../domain/models/client.model';
import {
  ClientInfrastructureError,
  ClientNotFoundError,
  InvalidClientInputError,
} from '../domain/errors/client.errors';

interface Envoltorio<T> {
  status: 'success' | 'error';
  message?: string;
  data: T;
}

/**
 * El ÚNICO sitio del módulo que conoce las rutas `/api/clients/:id/favorite` y
 * `/api/clients/favorites`. Mismo patrón que `HttpClientRepository`: traduce cada código del
 * contrato a un error de dominio ya existente, sin introducir una segunda taxonomía de errores
 * para el mismo recurso.
 */
@Injectable()
export class HttpFavoriteRepository implements FavoriteRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiEndpoint + '/clients';

  mark(clientId: string): Observable<void> {
    return this.http.post<Envoltorio<unknown>>(`${this.base}/${clientId}/favorite`, {}).pipe(
      map(() => undefined),
      catchError((e) => this.traducir(e, clientId)),
    );
  }

  unmark(clientId: string): Observable<void> {
    return this.http.delete<Envoltorio<unknown>>(`${this.base}/${clientId}/favorite`).pipe(
      map(() => undefined),
      catchError((e) => this.traducir(e, clientId)),
    );
  }

  listFavoriteClients(): Observable<ClientSummary[]> {
    return this.http.get<Envoltorio<ClientSummary[]>>(`${this.base}/favorites`).pipe(
      map((res) => res.data),
      catchError((e) => this.traducir(e)),
    );
  }

  private traducir(e: unknown, id?: string): Observable<never> {
    if (!(e instanceof HttpErrorResponse)) {
      return throwError(() => new ClientInfrastructureError(null, null));
    }
    const mensaje = this.mensajeDelServidor(e);

    switch (e.status) {
      case 404:
        return throwError(() => new ClientNotFoundError(id ?? '', mensaje));
      case 400:
        return throwError(() => new InvalidClientInputError([], mensaje));
      default:
        return throwError(
          () => new ClientInfrastructureError(e.status === 0 ? null : e.status, mensaje),
        );
    }
  }

  private mensajeDelServidor(e: HttpErrorResponse): string | null {
    const cuerpo = e.error as { message?: unknown } | null;
    return typeof cuerpo?.message === 'string' ? cuerpo.message : null;
  }
}
