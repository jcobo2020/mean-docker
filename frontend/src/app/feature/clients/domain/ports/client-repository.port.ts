// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import type { Client, ClientListQuery, ClientPage, CreateClientInput } from '../models/client.model';

/**
 * El contrato que el dominio conoce del mundo exterior.
 *
 * NO menciona HTTP, ni códigos de estado, ni el envoltorio `{status, message, data}` del contrato:
 * eso es detalle del adaptador. Lo que sí promete es que los fallos llegan como errores de dominio
 * tipados (`client.errors.ts`), nunca como `HttpErrorResponse`.
 *
 * NO declara actualización, y es deliberado: el contrato MEAN-CLI-004 no tiene endpoint de
 * actualización (registrado como CONTRATO-CLIENTES-SIN-ACTUALIZACION-001). Declarar aquí un
 * `update()` que nadie puede implementar sería prometer una capacidad inexistente.
 */
export interface ClientRepositoryPort {
  list(query: ClientListQuery): Observable<ClientPage>;
  findById(id: string): Observable<Client>;
  create(input: CreateClientInput): Observable<Client>;
  deactivate(id: string): Observable<void>;
}

/**
 * El token con el que se inyecta el puerto.
 *
 * Existe para que los casos de uso dependan de la INTERFAZ y no de la clase concreta: es lo que
 * permite probarlos con un doble en memoria sin tocar HTTP. Se provee en el enrutado del módulo.
 */
export const CLIENT_REPOSITORY = new InjectionToken<ClientRepositoryPort>('CLIENT_REPOSITORY');
