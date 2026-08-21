// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ClientRepositoryPort } from '../domain/ports/client-repository.port';
import type {
  Client,
  ClientListQuery,
  ClientPage,
  CreateClientInput,
} from '../domain/models/client.model';
import {
  ClientInfrastructureError,
  ClientNotFoundError,
  DuplicateClientEmailError,
  ForbiddenClientActionError,
  InvalidClientInputError,
  type ForbiddenAction,
} from '../domain/errors/client.errors';

/** El envoltorio estándar del contrato: todo viaja dentro de `data`. */
interface Envoltorio<T> {
  status: 'success' | 'error';
  message?: string;
  data: T;
}

/**
 * El ÚNICO sitio del módulo que conoce las rutas `/api/clients`, el envoltorio de respuesta y los
 * códigos HTTP.
 *
 * Su trabajo es exactamente ese: desenvolver `data` y traducir cada código del contrato al error de
 * dominio correspondiente. Todo lo demás del módulo trabaja con los tipos del dominio y no sabe que
 * existe HTTP.
 */
@Injectable()
export class HttpClientRepository implements ClientRepositoryPort {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiEndpoint + '/clients';

  list(query: ClientListQuery): Observable<ClientPage> {
    let params = new HttpParams()
      .set('page', String(query.page))
      .set('limit', String(query.limit));
    // El estado por defecto NO se envía: el contrato ya devuelve solo activos sin el parámetro, y
    // mandarlo explícitamente produce el mismo resultado con más ruido en la URL.
    if (query.status === 'inactive') params = params.set('status', 'inactive');

    return this.http.get<Envoltorio<ClientPage>>(this.base, { params }).pipe(
      map((res) => res.data),
      catchError((e) => this.traducir(e, 'filter_inactive')),
    );
  }

  findById(id: string): Observable<Client> {
    return this.http.get<Envoltorio<Client>>(`${this.base}/${id}`).pipe(
      map((res) => res.data),
      catchError((e) => this.traducir(e, undefined, id)),
    );
  }

  create(input: CreateClientInput): Observable<Client> {
    // `phone` vacío no viaja: el contrato trata ausente, null y cadena vacía como ausencia, y
    // enviarlo vacío dependería de esa equivalencia en vez de declararla aquí.
    const body: CreateClientInput = { name: input.name, email: input.email };
    if (input.phone && input.phone.trim().length > 0) body.phone = input.phone.trim();

    return this.http.post<Envoltorio<Client>>(this.base, body).pipe(
      map((res) => res.data),
      catchError((e) => this.traducir(e, 'create')),
    );
  }

  deactivate(id: string): Observable<void> {
    return this.http.delete<Envoltorio<Client>>(`${this.base}/${id}`).pipe(
      map(() => undefined),
      catchError((e) => this.traducir(e, 'deactivate', id)),
    );
  }

  /**
   * La traducción de código HTTP a error de dominio.
   *
   * El 401 NO se traduce aquí: lo trata el interceptor, que limpia la sesión y navega. Si llegara
   * hasta aquí sería porque el interceptor no está montado, y entonces cae en infraestructura —
   * que es lo correcto: sin sesión no hay nada que la pantalla pueda hacer por sí sola.
   */
  private traducir(
    e: unknown,
    accionProhibida?: ForbiddenAction,
    id?: string,
  ): Observable<never> {
    if (!(e instanceof HttpErrorResponse)) {
      return throwError(() => new ClientInfrastructureError(null, null));
    }
    const mensaje = this.mensajeDelServidor(e);

    switch (e.status) {
      case 404:
        return throwError(() => new ClientNotFoundError(id ?? '', mensaje));
      case 409:
        return throwError(() => new DuplicateClientEmailError(mensaje));
      case 400:
        return throwError(() => new InvalidClientInputError([], mensaje));
      case 403:
        return throwError(
          () => new ForbiddenClientActionError(accionProhibida ?? 'create', mensaje),
        );
      default:
        // `status: 0` significa que no hubo respuesta (red caída, CORS, servidor apagado): se
        // guarda como `null` para que la pantalla no muestre un «error 0» sin sentido.
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
