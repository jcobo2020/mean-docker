// [AI-GENERATED | WI: WI-UX-NOTA-CLIENTE-001 | spec: MEAN-UX-NOTA-CLIENTE-001]
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { createSpyObj } from '../../../../testing/spy-obj';
import {
  ListFavoriteClientsUseCase,
  MarkFavoriteUseCase,
  UnmarkFavoriteUseCase,
} from './favorite.use-cases';
import {
  FAVORITE_REPOSITORY,
  type FavoriteRepositoryPort,
} from '../domain/ports/favorite-repository.port';
import type { ClientSummary } from '../domain/models/client.model';

/**
 * Tests de cobertura para los casos de uso de favoritos.
 * Son delegaciones delgadas: el test verifica que cada use case llama al método correcto del repo.
 */

const CLIENTE: ClientSummary = {
  id: 'c1', name: 'Acme', email: 'a***@x.com', status: 'active', createdAt: '2026-01-01',
};

describe('MarkFavoriteUseCase', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('delega en repo.mark() con el id dado', () => {
    const repo = createSpyObj<FavoriteRepositoryPort>('FavoriteRepositoryPort', {
      mark: of(undefined),
      unmark: of(undefined),
      listFavoriteClients: of([]),
    });

    TestBed.configureTestingModule({
      providers: [
        MarkFavoriteUseCase,
        { provide: FAVORITE_REPOSITORY, useValue: repo },
      ],
    });

    const uc = TestBed.inject(MarkFavoriteUseCase);
    let completado = false;
    uc.execute('c1').subscribe(() => (completado = true));

    expect(repo.mark).toHaveBeenCalledWith('c1');
    expect(completado).toBe(true);
  });
});

describe('UnmarkFavoriteUseCase', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('delega en repo.unmark() con el id dado', () => {
    const repo = createSpyObj<FavoriteRepositoryPort>('FavoriteRepositoryPort', {
      mark: of(undefined),
      unmark: of(undefined),
      listFavoriteClients: of([]),
    });

    TestBed.configureTestingModule({
      providers: [
        UnmarkFavoriteUseCase,
        { provide: FAVORITE_REPOSITORY, useValue: repo },
      ],
    });

    const uc = TestBed.inject(UnmarkFavoriteUseCase);
    let completado = false;
    uc.execute('c1').subscribe(() => (completado = true));

    expect(repo.unmark).toHaveBeenCalledWith('c1');
    expect(completado).toBe(true);
  });
});

describe('ListFavoriteClientsUseCase', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('delega en repo.listFavoriteClients() y devuelve la lista', () => {
    const repo = createSpyObj<FavoriteRepositoryPort>('FavoriteRepositoryPort', {
      mark: of(undefined),
      unmark: of(undefined),
      listFavoriteClients: of([CLIENTE]),
    });

    TestBed.configureTestingModule({
      providers: [
        ListFavoriteClientsUseCase,
        { provide: FAVORITE_REPOSITORY, useValue: repo },
      ],
    });

    const uc = TestBed.inject(ListFavoriteClientsUseCase);
    let recibido: ClientSummary[] | undefined;
    uc.execute().subscribe((r) => (recibido = r));

    expect(repo.listFavoriteClients).toHaveBeenCalled();
    expect(recibido).toEqual([CLIENTE]);
  });
});
