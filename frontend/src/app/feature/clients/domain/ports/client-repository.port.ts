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
 * NO declara actualización general, y es deliberado: el contrato MEAN-CLI-004 no tiene endpoint de
 * actualización (registrado como CONTRATO-CLIENTES-SIN-ACTUALIZACION-001). Solo se declara lo que
 * el contrato puede implementar: `updateNote` corresponde a `PATCH /api/clients/:id/note`.
 */
export interface ClientRepositoryPort {
  list(query: ClientListQuery): Observable<ClientPage>;
  findById(id: string): Observable<Client>;
  create(input: CreateClientInput): Observable<Client>;
  deactivate(id: string): Observable<void>;
  /**
   * Reemplaza la nota interna del cliente (RN-01: solo existe una nota por cliente).
   * Pasar `null` elimina la nota. Corresponde a `PATCH /api/clients/:id/note`.
   */
  updateNote(id: string, note: string | null): Observable<void>;
}

/**
 * El token con el que se inyecta el puerto.
 *
 * Existe para que los casos de uso dependan de la INTERFAZ y no de la clase concreta: es lo que
 * permite probarlos con un doble en memoria sin tocar HTTP. Se provee en el enrutado del módulo.
 */
export const CLIENT_REPOSITORY = new InjectionToken<ClientRepositoryPort>('CLIENT_REPOSITORY');
