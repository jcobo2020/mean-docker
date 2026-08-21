// [AI-GENERATED | WI: WI-API-CLIENTES-FAV-001 | spec: MEAN-UX-CLIENTES-FAV-001 | contrato: MEAN-API-CLIENTES-FAV-001]
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FAVORITE_REPOSITORY } from '../domain/ports/favorite-repository.port';
import type { ClientSummary } from '../domain/models/client.model';

@Injectable()
export class MarkFavoriteUseCase {
  private readonly repo = inject(FAVORITE_REPOSITORY);
  execute(clientId: string): Observable<void> {
    return this.repo.mark(clientId);
  }
}

@Injectable()
export class UnmarkFavoriteUseCase {
  private readonly repo = inject(FAVORITE_REPOSITORY);
  execute(clientId: string): Observable<void> {
    return this.repo.unmark(clientId);
  }
}

@Injectable()
export class ListFavoriteClientsUseCase {
  private readonly repo = inject(FAVORITE_REPOSITORY);
  execute(): Observable<ClientSummary[]> {
    return this.repo.listFavoriteClients();
  }
}
