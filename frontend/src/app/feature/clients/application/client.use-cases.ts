// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CLIENT_REPOSITORY } from '../domain/ports/client-repository.port';
import type {
  Client,
  ClientListQuery,
  ClientPage,
  CreateClientInput,
} from '../domain/models/client.model';

/**
 * Los casos de uso del módulo.
 *
 * Son delgados A PROPÓSITO: orquestan y no repiten reglas que el servidor ya aplica. Duplicar aquí
 * la validación de unicidad o el filtro por rol crearía una segunda fuente de verdad que envejece
 * en cuanto el contrato cambie.
 *
 * Inyectan el TOKEN, nunca la clase concreta: es lo que permite probarlos con un doble en memoria.
 * Y no capturan los errores del repositorio — los dejan pasar tipados hasta la pantalla, que es
 * quien sabe dónde pintarlos.
 */

@Injectable()
export class ListClientsUseCase {
  private readonly repo = inject(CLIENT_REPOSITORY);
  execute(query: ClientListQuery): Observable<ClientPage> {
    return this.repo.list(query);
  }
}

@Injectable()
export class GetClientUseCase {
  private readonly repo = inject(CLIENT_REPOSITORY);
  execute(id: string): Observable<Client> {
    return this.repo.findById(id);
  }
}

@Injectable()
export class CreateClientUseCase {
  private readonly repo = inject(CLIENT_REPOSITORY);
  execute(input: CreateClientInput): Observable<Client> {
    return this.repo.create(input);
  }
}

@Injectable()
export class DeactivateClientUseCase {
  private readonly repo = inject(CLIENT_REPOSITORY);
  execute(id: string): Observable<void> {
    return this.repo.deactivate(id);
  }
}
