// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpClientRepository } from './http-client.repository';
import type { ClientPage } from '../domain/models/client.model';

/**
 * Las pruebas del ADAPTADOR son las de más valor del módulo: es el único que conoce el contrato
 * MEAN-CLI-004, así que un fallo aquí es una divergencia REAL con el backend, no un detalle de
 * presentación.
 */
describe('HttpClientRepository — traduce el contrato MEAN-CLI-004', () => {
  let repo: HttpClientRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpClientRepository],
    });
    repo = TestBed.inject(HttpClientRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('desenvuelve `data` y no devuelve el envoltorio del contrato', () => {
    const pagina: ClientPage = { items: [], total: 0, page: 1, limit: 20 };
    let recibido: ClientPage | undefined;

    repo.list({ page: 1, limit: 20 }).subscribe((p) => (recibido = p));
    const req = http.expectOne((r) => r.url === '/api/clients');
    req.flush({ status: 'success', message: 'ok', data: pagina });

    expect(recibido).toEqual(pagina);
  });

  it('NO envía `status` cuando se piden activos — el contrato ya lo hace por defecto', () => {
    repo.list({ page: 2, limit: 50, status: 'active' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/clients');
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ status: 'success', data: { items: [], total: 0, page: 2, limit: 50 } });
  });

  it('sí envía `status=inactive` cuando se piden inactivos', () => {
    repo.list({ page: 1, limit: 20, status: 'inactive' }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/clients');
    expect(req.request.params.get('status')).toBe('inactive');
    req.flush({ status: 'success', data: { items: [], total: 0, page: 1, limit: 20 } });
  });

  it('409 → DuplicateClientEmailError con `field: email`, que es lo que pinta el error en su sitio', () => {
    let error: any;
    repo.create({ name: 'A', email: 'a@b.com' }).subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/clients').flush(
      { status: 'error', message: 'duplicado' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(error.kind).toBe('duplicate_email');
    expect(error.field).toBe('email');
    // El valor tecleado NO viaja en el error: es dato sensible y acabaría en trazas de fallo.
    expect(error.attemptedValue).toBeUndefined();
    expect(error.serverMessage).toBe('duplicado');
  });

  it('404 → ClientNotFoundError con el id que se pidió', () => {
    let error: any;
    repo.findById('abc').subscribe({ error: (e) => (error = e) });
    http.expectOne('/api/clients/abc').flush({ status: 'error' }, { status: 404, statusText: 'Not Found' });

    expect(error.kind).toBe('not_found');
    expect(error.id).toBe('abc');
  });

  it('403 → ForbiddenClientActionError, con la acción que lo distingue', () => {
    let deFiltro: any;
    let deAlta: any;
    repo.list({ page: 1, limit: 20, status: 'inactive' }).subscribe({ error: (e) => (deFiltro = e) });
    http.expectOne((r) => r.url === '/api/clients').flush({}, { status: 403, statusText: 'Forbidden' });

    repo.create({ name: 'A', email: 'a@b.com' }).subscribe({ error: (e) => (deAlta = e) });
    http.expectOne('/api/clients').flush({}, { status: 403, statusText: 'Forbidden' });

    // La acción es lo que decide DÓNDE se pinta el aviso: junto al filtro o sobre el botón.
    expect(deFiltro.action).toBe('filter_inactive');
    expect(deAlta.action).toBe('create');
  });

  it('400 → InvalidClientInputError', () => {
    let error: any;
    repo.list({ page: 9999, limit: 20 }).subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/clients').flush({}, { status: 400, statusText: 'Bad Request' });
    expect(error.kind).toBe('invalid_input');
  });

  it('5xx → ClientInfrastructureError reintentable, con su código', () => {
    let error: any;
    repo.list({ page: 1, limit: 20 }).subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/clients').flush({}, { status: 503, statusText: 'Unavailable' });

    expect(error.kind).toBe('infrastructure');
    expect(error.retriable).toBe(true);
    expect(error.status).toBe(503);
  });

  it('sin respuesta (red caída) → infraestructura con status null, no «error 0»', () => {
    let error: any;
    repo.list({ page: 1, limit: 20 }).subscribe({ error: (e) => (error = e) });
    http.expectOne((r) => r.url === '/api/clients').error(new ProgressEvent('error'));

    expect(error.kind).toBe('infrastructure');
    // `null` y no `0`: mostrar «error 0» al usuario no significa nada.
    expect(error.status).toBeNull();
  });

  it('`phone` vacío NO viaja — el contrato trata vacío y ausente como lo mismo', () => {
    repo.create({ name: 'A', email: 'a@b.com', phone: '   ' }).subscribe();
    const req = http.expectOne('/api/clients');
    expect('phone' in req.request.body).toBe(false);
    req.flush({ status: 'success', data: {} });
  });

  it('`phone` con valor sí viaja, recortado', () => {
    repo.create({ name: 'A', email: 'a@b.com', phone: ' +34600123456 ' }).subscribe();
    const req = http.expectOne('/api/clients');
    expect(req.request.body.phone).toBe('+34600123456');
    req.flush({ status: 'success', data: {} });
  });

  it('desactivar usa DELETE sobre el id y no devuelve cuerpo', () => {
    let completado = false;
    repo.deactivate('xyz').subscribe({ complete: () => (completado = true) });
    const req = http.expectOne('/api/clients/xyz');
    expect(req.request.method).toBe('DELETE');
    req.flush({ status: 'success', data: {} });
    expect(completado).toBe(true);
  });
});
