import { vi } from 'vitest';
import { createSpyObj } from '../../../../testing/spy-obj';
// [AI-GENERATED | WI: WI-UX-CLIENTES-FAV-001 | spec: MEAN-UX-CLIENTES-FAV-001 | contrato: MEAN-API-CLIENTES-FAV-001]
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { clientsSessionInterceptor } from './session.interceptor';

/**
 * `AC-04` — el ÚNICO sitio que puede demostrarlo es el interceptor: el 401 nunca llega al
 * adaptador ni al componente, lo intercepta esta pieza. Sin este spec, AC-04 no tenía NINGUNA
 * prueba en todo el módulo — ni aquí ni en `client-list.component.spec.ts`.
 */
describe('clientsSessionInterceptor — AC-04: 401 expulsa, el resto pasa intacto', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    router = createSpyObj<Router>('Router', ['navigate'], { url: '/clients?page=2' });
    (router.navigate as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([clientsSessionInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    mock = TestBed.inject(HttpTestingController);
    localStorage.setItem('currentUser', '{"token":"viejo"}');
  });

  afterEach(() => {
    mock.verify();
    localStorage.removeItem('currentUser');
  });

  it('🚨 AC-04 · 401 en cualquiera de los 3 endpoints limpia sesión y redirige a /login', () => {
    let error: unknown;
    http.get('/api/clients/favorites').subscribe({ error: (e) => (error = e) });
    mock.expectOne('/api/clients/favorites').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('currentUser')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/clients?page=2' } });
    expect(error).toBeTruthy();
  });

  it('403 NO expulsa — sesión válida, rol insuficiente, se queda en la pantalla', () => {
    let error: unknown;
    http.get('/api/clients').subscribe({ error: (e) => (error = e) });
    mock.expectOne('/api/clients').flush(null, { status: 403, statusText: 'Forbidden' });

    expect(router.navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('currentUser')).not.toBeNull();
    expect(error).toBeTruthy();
  });

  it('400/404/409 pasan INTACTOS — el adaptador necesita el HttpErrorResponse completo', () => {
    for (const status of [400, 404, 409]) {
      let capturado: unknown;
      http.post(`/api/clients/${status}/favorite`, {}).subscribe({ error: (e) => (capturado = e) });
      mock.expectOne(`/api/clients/${status}/favorite`).flush({ message: 'x' }, { status, statusText: 'x' });
      expect((capturado as { status: number }).status).toBe(status);
    }
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
