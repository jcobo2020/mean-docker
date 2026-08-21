// [AI-GENERATED | WI: WI-API-CLIENTES-FAV-001 | spec: MEAN-UX-CLIENTES-FAV-001 | contrato: MEAN-API-CLIENTES-FAV-001]
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpFavoriteRepository } from './http-favorite.repository';
import type { ClientSummary } from '../domain/models/client.model';

/**
 * Mismo criterio que `http-client.repository.spec.ts`: este adaptador es el único que conoce las
 * rutas de favoritos, así que un fallo aquí es una divergencia real con el contrato
 * MEAN-API-CLIENTES-FAV-001.
 */
describe('HttpFavoriteRepository — traduce el contrato MEAN-API-CLIENTES-FAV-001', () => {
  let repo: HttpFavoriteRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpFavoriteRepository],
    });
    repo = TestBed.inject(HttpFavoriteRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('mark() hace POST a /clients/:id/favorite', () => {
    let completo = false;
    repo.mark('abc').subscribe(() => (completo = true));
    const req = http.expectOne((r) => r.url === '/api/clients/abc/favorite' && r.method === 'POST');
    req.flush({ status: 'success', data: { clientId: 'abc', userId: 'u1', createdAt: '2026-01-01' } });
    expect(completo).toBe(true);
  });

  it('unmark() hace DELETE a /clients/:id/favorite', () => {
    let completo = false;
    repo.unmark('abc').subscribe(() => (completo = true));
    const req = http.expectOne(
      (r) => r.url === '/api/clients/abc/favorite' && r.method === 'DELETE',
    );
    req.flush({ status: 'success', data: { clientId: 'abc', userId: 'u1', deleted: true } });
    expect(completo).toBe(true);
  });

  it('listFavoriteClients() desenvuelve `data` como el array de clientes', () => {
    const clientes: ClientSummary[] = [
      { id: 'a', name: 'Acme', email: 'o***@x.com', status: 'active', createdAt: '2026-01-01' },
    ];
    let recibido: ClientSummary[] | undefined;

    repo.listFavoriteClients().subscribe((c) => (recibido = c));
    const req = http.expectOne((r) => r.url === '/api/clients/favorites');
    req.flush({ status: 'success', data: clientes });

    expect(recibido).toEqual(clientes);
  });

  it('404 al marcar → ClientNotFoundError con el id que se pidió', () => {
    let error: any;
    repo.mark('inexistente').subscribe({ error: (e) => (error = e) });
    http
      .expectOne('/api/clients/inexistente/favorite')
      .flush({ status: 'error' }, { status: 404, statusText: 'Not Found' });

    expect(error.kind).toBe('not_found');
    expect(error.id).toBe('inexistente');
  });

  it('400 al marcar con id inválido → InvalidClientInputError', () => {
    let error: any;
    repo.mark('malo').subscribe({ error: (e) => (error = e) });
    http
      .expectOne('/api/clients/malo/favorite')
      .flush({ status: 'error', message: 'id must be a valid ObjectId' }, { status: 400, statusText: 'Bad Request' });

    expect(error.kind).toBe('invalid_input');
    expect(error.serverMessage).toBe('id must be a valid ObjectId');
  });

  it('fallo de red (status 0) → ClientInfrastructureError con status null', () => {
    let error: any;
    repo.listFavoriteClients().subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/clients/favorites').error(new ProgressEvent('network error'), { status: 0 });

    expect(error.kind).toBe('infrastructure');
    expect(error.status).toBeNull();
  });
});
