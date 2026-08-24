// [AI-GENERATED | WI: WI-UX-CLIENTES-FAV-001 | spec: MEAN-UX-CLIENTES-FAV-001 | contrato: MEAN-API-CLIENTES-FAV-001]
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { By } from '@angular/platform-browser';
import { ClientListComponent } from './client-list.component';
import { ListClientsUseCase } from '../../application/client.use-cases';
import {
  ListFavoriteClientsUseCase,
  MarkFavoriteUseCase,
  UnmarkFavoriteUseCase,
} from '../../application/favorite.use-cases';
import type { ClientPage, ClientSummary } from '../../domain/models/client.model';
import {
  ClientInfrastructureError,
  ClientNotFoundError,
  InvalidClientInputError,
} from '../../domain/errors/client.errors';

/**
 * `WI-UX-CLIENTES-FAV-001` — los 9 AC de la pantalla `/clients`, uno por test.
 *
 * El comportamiento ya estaba implementado (de una vuelta anterior del mismo ciclo, mergeada como
 * PR #4); lo que faltaba era la prueba que lo deja demostrado — la guía de stack de este repo lo
 * dice sin rodeos: "una feature no está terminada sin sus specs en verde".
 *
 * Se prueba en el límite del CASO DE USO (no HTTP): los use cases son clases delgadas inyectadas
 * por token de clase, así que un doble (`jasmine.createSpyObj`) sustituye la implementación entera
 * sin tocar `HttpClient`. Las traducciones HTTP→error de dominio ya las cubre
 * `http-favorite.repository.spec.ts`; aquí se prueba qué hace la PANTALLA con esos errores.
 */

const CLIENTE: ClientSummary = {
  id: 'c1', name: 'Acme', email: 'a***@x.com', status: 'active', createdAt: '2026-01-01',
};
const PAGINA_CON_DATOS: ClientPage = { items: [CLIENTE], total: 1, page: 1, limit: 20 };
const PAGINA_VACIA: ClientPage = { items: [], total: 0, page: 1, limit: 20 };

function crear(opciones: {
  params?: Record<string, string>;
  listar?: ReturnType<typeof jasmine.createSpyObj>;
  marcar?: ReturnType<typeof jasmine.createSpyObj>;
  desmarcar?: ReturnType<typeof jasmine.createSpyObj>;
  listarFavoritos?: ReturnType<typeof jasmine.createSpyObj>;
} = {}) {
  const listar = opciones.listar
    ?? jasmine.createSpyObj<ListClientsUseCase>('ListClientsUseCase', { execute: of(PAGINA_CON_DATOS) });
  const marcar = opciones.marcar
    ?? jasmine.createSpyObj<MarkFavoriteUseCase>('MarkFavoriteUseCase', { execute: of(undefined) });
  const desmarcar = opciones.desmarcar
    ?? jasmine.createSpyObj<UnmarkFavoriteUseCase>('UnmarkFavoriteUseCase', { execute: of(undefined) });
  const listarFavoritos = opciones.listarFavoritos
    ?? jasmine.createSpyObj<ListFavoriteClientsUseCase>('ListFavoriteClientsUseCase', { execute: of([]) });
  const router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/clients' });
  router.navigate.and.resolveTo(true);

  TestBed.configureTestingModule({
    imports: [ClientListComponent],
    providers: [
      { provide: ListClientsUseCase, useValue: listar },
      { provide: MarkFavoriteUseCase, useValue: marcar },
      { provide: UnmarkFavoriteUseCase, useValue: desmarcar },
      { provide: ListFavoriteClientsUseCase, useValue: listarFavoritos },
      { provide: Router, useValue: router },
      {
        provide: ActivatedRoute,
        useValue: { queryParamMap: of(convertToParamMap(opciones.params ?? {})) },
      },
    ],
  });

  const fixture: ComponentFixture<ClientListComponent> = TestBed.createComponent(ClientListComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, router, listar, marcar, desmarcar, listarFavoritos };
}

describe('ClientListComponent — /clients y sus 9 criterios de aceptación', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('🚨 AC-01 · lista con columna de favorito, botón de estrella y desplegable "Solo favoritos"', () => {
    const listarFavoritos = jasmine.createSpyObj<ListFavoriteClientsUseCase>(
      'ListFavoriteClientsUseCase', { execute: of([CLIENTE]) },
    );
    const { fixture, component } = crear({ listarFavoritos });

    expect(component.estado()).toBe('con-datos');
    expect(component.esFavorito(CLIENTE)).toBe(true, 'el cliente favorito no se marcó');

    const tabla = fixture.debugElement.query(By.css('[data-testid="tabla"]'));
    expect(tabla).not.toBeNull('la tabla no se renderizó');
    const estrella = fixture.debugElement.query(By.css('[data-testid="toggle-favorito"]'));
    expect(estrella).not.toBeNull('el botón de estrella no está en la fila');
    expect(estrella.attributes['aria-pressed']).toBe('true');
    expect(fixture.debugElement.query(By.css('[data-testid="filtro-favoritos"]')))
      .not.toBeNull('falta el desplegable "Solo favoritos"');
  });

  it('🚨 AC-02 · mientras /clients espera los datos, muestra el spinner', () => {
    // Un Subject que NUNCA emite dentro del test deja la vista congelada en "cargando" — es
    // exactamente la ventana que el AC pide comprobar.
    const pendiente = new Subject<ClientPage>();
    const listar = jasmine.createSpyObj<ListClientsUseCase>('ListClientsUseCase', { execute: pendiente });
    const { fixture, component } = crear({ listar });

    expect(component.estado()).toBe('cargando');
    expect(fixture.debugElement.query(By.css('[data-testid="cargando"]')))
      .not.toBeNull('no se pintó el skeleton de carga');
    expect(fixture.debugElement.query(By.css('[data-testid="tabla"]')))
      .toBeNull('la tabla apareció antes de tener datos');
  });

  it('🚨 AC-03a · "Solo favoritos" vacío muestra el mensaje EXACTO que declara la spec', () => {
    const listarFavoritos = jasmine.createSpyObj<ListFavoriteClientsUseCase>(
      'ListFavoriteClientsUseCase', { execute: of([]) },
    );
    const { fixture, component } = crear({ params: { favorites: '1' }, listarFavoritos });

    expect(component.estado()).toBe('vacio');
    expect(fixture.debugElement.nativeElement.textContent)
      .toContain('Todavía no marcaste ningún cliente como favorito');
  });

  it('🚨 AC-03b · un fallo de red en GET favorites (modo "Solo favoritos") es error genérico, NO el vacío de favoritos', () => {
    // La distinción que el AC exige textualmente: una lista vacía LEGÍTIMA y un fallo de lectura
    // no pueden compartir mensaje, o el usuario cree que no tiene favoritos cuando en realidad la
    // API no respondió.
    const listarFavoritos = jasmine.createSpyObj<ListFavoriteClientsUseCase>(
      'ListFavoriteClientsUseCase',
      { execute: throwError(() => new ClientInfrastructureError(500, null)) },
    );
    const { fixture, component } = crear({ params: { favorites: '1' }, listarFavoritos });

    expect(component.estado()).toBe('error', 'un fallo de red se disfrazó de "sin favoritos"');
    expect(fixture.debugElement.nativeElement.textContent)
      .not.toContain('Todavía no marcaste ningún cliente como favorito');
  });

  it('AC-03c · sin favoritos ni filtro de "Solo favoritos", el vacío general no se confunde con el de favoritos', () => {
    const listar = jasmine.createSpyObj<ListClientsUseCase>('ListClientsUseCase', { execute: of(PAGINA_VACIA) });
    const { fixture } = crear({ listar });
    expect(fixture.debugElement.nativeElement.textContent).toContain('Todavía no hay clientes registrados');
  });

  it('🚨 AC-06 · 201 al marcar: el ícono ya estaba relleno de forma optimista, sin aviso extra', () => {
    const marcado = new Subject<void>();
    const marcar = jasmine.createSpyObj<MarkFavoriteUseCase>('MarkFavoriteUseCase', { execute: marcado });
    const { component } = crear({ marcar });

    component.toggleFavorito(CLIENTE);
    // Optimista: el estado local ya refleja el cambio ANTES de que el servidor confirme.
    expect(component.esFavorito(CLIENTE)).toBe(true, 'no se aplicó el flip optimista al pulsar');
    expect(component.estaPendiente(CLIENTE)).toBe(true);

    marcado.next(); marcado.complete();
    expect(component.esFavorito(CLIENTE)).toBe(true);
    expect(component.estaPendiente(CLIENTE)).toBe(false);
    expect(component.aviso()).toBeNull('un 201 exitoso no debe producir aviso adicional');
  });

  it('🚨 AC-05 · 200 al desmarcar (idempotente): confirma sin feedback visual adicional', () => {
    const listarFavoritos = jasmine.createSpyObj<ListFavoriteClientsUseCase>(
      'ListFavoriteClientsUseCase', { execute: of([CLIENTE]) },
    );
    const desmarcado = new Subject<void>();
    const desmarcar = jasmine.createSpyObj<UnmarkFavoriteUseCase>('UnmarkFavoriteUseCase', { execute: desmarcado });
    const { component } = crear({ listarFavoritos, desmarcar });

    expect(component.esFavorito(CLIENTE)).toBe(true);
    component.toggleFavorito(CLIENTE);
    expect(component.esFavorito(CLIENTE)).toBe(false, 'no se aplicó el flip optimista al desmarcar');

    desmarcado.next(); desmarcado.complete();
    expect(component.esFavorito(CLIENTE)).toBe(false);
    expect(component.aviso()).toBeNull();
  });

  it('🚨 AC-07 · 400 al togglear: revierte el flip Y muestra el aviso genérico', () => {
    const marcar = jasmine.createSpyObj<MarkFavoriteUseCase>(
      'MarkFavoriteUseCase', { execute: throwError(() => new InvalidClientInputError([], null)) },
    );
    const { component } = crear({ marcar });

    component.toggleFavorito(CLIENTE);

    expect(component.esFavorito(CLIENTE)).toBe(false, 'el 400 no revirtió el toggle optimista');
    expect(component.estaPendiente(CLIENTE)).toBe(false);
    expect(component.aviso()).toBe('No se pudo actualizar el favorito. Intenta de nuevo.');
  });

  it('🚨 AC-08 · 404 al togglear: revierte el flip con el MISMO aviso genérico', () => {
    const marcar = jasmine.createSpyObj<MarkFavoriteUseCase>(
      'MarkFavoriteUseCase', { execute: throwError(() => new ClientNotFoundError(CLIENTE.id, null)) },
    );
    const { component } = crear({ marcar });

    component.toggleFavorito(CLIENTE);

    expect(component.esFavorito(CLIENTE)).toBe(false, 'el 404 no revirtió el toggle optimista');
    expect(component.aviso()).toBe('No se pudo actualizar el favorito. Intenta de nuevo.');
  });

  it('🚨 AC-09 · 500/timeout al togglear: revierte, mismo aviso, SIN reintento automático', () => {
    const marcar = jasmine.createSpyObj<MarkFavoriteUseCase>(
      'MarkFavoriteUseCase', { execute: throwError(() => new ClientInfrastructureError(500, null)) },
    );
    const { component } = crear({ marcar });

    component.toggleFavorito(CLIENTE);

    expect(component.esFavorito(CLIENTE)).toBe(false, 'el 500 no revirtió el toggle optimista');
    expect(component.aviso()).toBe('No se pudo actualizar el favorito. Intenta de nuevo.');
    // "Sin reintento automático": el use case se invocó UNA vez, no más.
    expect(marcar.execute).toHaveBeenCalledTimes(1);
  });
});
