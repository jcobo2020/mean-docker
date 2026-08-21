// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
// [AI-GENERATED | WI: WI-API-CLIENTES-FAV-001 | spec: MEAN-UX-CLIENTES-FAV-001 | contrato: MEAN-API-CLIENTES-FAV-001]
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import {
  PAGINA_POR_DEFECTO,
  TAMANOS_DE_PAGINA,
  TAMANO_POR_DEFECTO,
  type ClientPage,
  type ClientStatusFilter,
  type ClientSummary,
} from '../../domain/models/client.model';
import { esErrorDeCliente, type AnyClientError } from '../../domain/errors/client.errors';
import { ListClientsUseCase } from '../../application/client.use-cases';
import {
  ListFavoriteClientsUseCase,
  MarkFavoriteUseCase,
  UnmarkFavoriteUseCase,
} from '../../application/favorite.use-cases';

/** Lo que la vista está mostrando ahora mismo. Un solo valor: dos banderas se contradicen. */
type EstadoDeVista = 'cargando' | 'con-datos' | 'vacio' | 'error';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.css',
})
export class ClientListComponent {
  private readonly listar = inject(ListClientsUseCase);
  private readonly marcar = inject(MarkFavoriteUseCase);
  private readonly desmarcar = inject(UnmarkFavoriteUseCase);
  private readonly listarFavoritos = inject(ListFavoriteClientsUseCase);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly tamanos = TAMANOS_DE_PAGINA;

  readonly estado = signal<EstadoDeVista>('cargando');
  readonly pagina = signal<ClientPage | null>(null);
  /** Aviso que NO saca al usuario de la pantalla: el 403 del filtro, el 404 al desactivar. */
  readonly aviso = signal<string | null>(null);
  /** Marca la tabla como desactualizada en vez de borrarla cuando una recarga falla. */
  readonly desactualizada = signal(false);

  // Los parámetros de la vista viven en la URL: así es enlazable y sobrevive a una recarga.
  readonly paginaActual = signal(PAGINA_POR_DEFECTO);
  readonly tamanoActual = signal<number>(TAMANO_POR_DEFECTO);
  readonly estadoFiltro = signal<ClientStatusFilter>('active');
  /**
   * "Solo favoritos" es EXCLUYENTE con el filtro de Estado (MEAN-DISENO-CLIENTES-FAV-001): activarlo
   * cambia el data source a `GET /clients/favorites`, que no pagina ni acepta `status` — no es un
   * tercer valor de `estadoFiltro`, es una vista distinta.
   */
  readonly soloFavoritos = signal(false);

  /** Los ids del cliente actual que son favorito del usuario autenticado — pinta la estrella. */
  readonly favoritos = signal<ReadonlySet<string>>(new Set());
  /** Evita doble clic mientras el toggle de una fila está en vuelo (RN-01, diseño). */
  readonly favoritosPendientes = signal<ReadonlySet<string>>(new Set());

  /**
   * Distingue los DOS vacíos, porque no son la misma situación: sin filtros es «aún no hay nada» y
   * con filtro es «nada coincide». Un solo mensaje para ambos manda al usuario a buscar un problema
   * donde no lo hay. En "Solo favoritos" el vacío es un tercer caso (RN-04: estado inicial esperado,
   * no un filtro restrictivo) y se distingue en la plantilla por `soloFavoritos()`.
   */
  readonly vacioPorFiltro = computed(
    () =>
      !this.soloFavoritos() && (this.estadoFiltro() === 'inactive' || this.paginaActual() > 1),
  );

  readonly totalPaginas = computed(() => {
    const p = this.pagina();
    if (!p || p.limit <= 0) return 1;
    return Math.max(1, Math.ceil(p.total / p.limit));
  });

  constructor() {
    // Se LEE de la URL en cada activación, no se guarda en el componente: así el botón atrás y la
    // edición manual de la dirección funcionan solos, sin código que los sincronice.
    this.ruta.queryParamMap
      .pipe(
        switchMap((params) => {
          this.paginaActual.set(this.numero(params.get('page'), PAGINA_POR_DEFECTO));
          this.tamanoActual.set(this.tamanoValido(params.get('limit')));
          this.estadoFiltro.set(params.get('status') === 'inactive' ? 'inactive' : 'active');
          this.soloFavoritos.set(params.get('favorites') === '1');

          if (this.pagina() === null) this.estado.set('cargando');
          else this.desactualizada.set(true);

          if (this.soloFavoritos()) {
            // "Solo favoritos": el propio listado YA son los favoritos, no hace falta cruzarlo con
            // una segunda llamada — cada fila mostrada es, por definición, favorita.
            return this.listarFavoritos.execute().pipe(
              switchMap((items) => {
                this.favoritos.set(new Set(items.map((c) => c.id)));
                return of({ items, total: items.length, page: 1, limit: items.length || 1 });
              }),
            );
          }

          // Vista normal: el listado paginado y el conjunto de favoritos del usuario se piden en
          // paralelo — la estrella de cada fila depende del segundo, no del primero.
          // `switchMap` cancela la petición anterior: sin él, una respuesta lenta de la página
          // previa puede pisar a la actual y mostrar datos que el usuario ya no pidió.
          return forkJoin({
            pagina: this.listar.execute({
              page: this.paginaActual(),
              limit: this.tamanoActual(),
              ...(this.estadoFiltro() === 'inactive' ? { status: 'inactive' as const } : {}),
            }),
            favoritos: this.listarFavoritos.execute().pipe(catchError(() => of([]))),
          }).pipe(
            switchMap(({ pagina, favoritos }) => {
              this.favoritos.set(new Set(favoritos.map((c) => c.id)));
              return of(pagina);
            }),
          );
        }),
      )
      .subscribe({
        next: (p) => this.recibir(p),
        error: (e) => this.fallar(e),
      });
  }

  private recibir(p: ClientPage): void {
    this.pagina.set(p);
    this.desactualizada.set(false);
    this.estado.set(p.items.length === 0 ? 'vacio' : 'con-datos');
  }

  /**
   * Un fallo no es siempre un estado de error: el 403 del filtro se resuelve DENTRO de la pantalla,
   * revirtiendo el filtro, y el usuario no debería ver un bloque de error por pedir algo que no le
   * corresponde. Solo la familia de infraestructura tumba la vista.
   */
  private fallar(e: unknown): void {
    this.desactualizada.set(false);
    if (!esErrorDeCliente(e)) {
      this.estado.set('error');
      return;
    }
    const err: AnyClientError = e;

    switch (err.kind) {
      case 'forbidden':
        this.aviso.set('Solo un administrador puede ver clientes inactivos');
        this.irA({ status: null, page: 1 });
        return;
      case 'invalid_input':
        // Entró por enlace directo con una vista imposible (`?page=9999`). No es culpa suya, así
        // que el texto no le pide corregir nada: se cae a la vista por defecto y se corrige la URL
        // para que refleje lo que de verdad se está mostrando.
        this.aviso.set('La vista solicitada no es válida; se muestra la primera página');
        this.irA({ page: PAGINA_POR_DEFECTO, limit: TAMANO_POR_DEFECTO, status: null });
        return;
      case 'not_found':
        this.aviso.set('Ese cliente ya no está disponible');
        this.recargar();
        return;
      default:
        this.estado.set('error');
    }
  }

  // ── Acciones de la vista ──────────────────────────────────────────────────

  irAPagina(n: number): void {
    if (n < 1 || n > this.totalPaginas()) return;
    this.irA({ page: n });
  }

  cambiarTamano(valor: string): void {
    // Vuelve a la página 1: conservarla al cambiar el tamaño produce con frecuencia una página
    // fuera de rango y una lista vacía que parece un error.
    this.irA({ limit: this.tamanoValido(valor), page: 1 });
  }

  cambiarEstado(valor: string): void {
    this.aviso.set(null);
    this.irA({ status: valor === 'inactive' ? 'inactive' : null, page: 1 });
  }

  cambiarSoloFavoritos(valor: string): void {
    this.aviso.set(null);
    this.irA({ favorites: valor === '1' ? '1' : null, page: 1 });
  }

  esFavorito(cliente: ClientSummary): boolean {
    return this.favoritos().has(cliente.id);
  }

  estaPendiente(cliente: ClientSummary): boolean {
    return this.favoritosPendientes().has(cliente.id);
  }

  /**
   * Toggle optimista (diseño MEAN-DISENO-CLIENTES-FAV-001): el ícono cambia al instante y se
   * revierte solo si el request falla. El botón se marca "pendiente" mientras está en vuelo para
   * evitar un doble clic — la idempotencia del backend ya lo resuelve bien, pero un doble ícono
   * visual confunde aunque el resultado final sea correcto.
   */
  toggleFavorito(cliente: ClientSummary): void {
    if (this.estaPendiente(cliente)) return;

    const eraFavorito = this.esFavorito(cliente);
    this.marcarPendiente(cliente.id, true);
    this.aplicarFavoritoLocal(cliente.id, !eraFavorito);

    const accion = eraFavorito
      ? this.desmarcar.execute(cliente.id)
      : this.marcar.execute(cliente.id);

    accion.subscribe({
      next: () => this.marcarPendiente(cliente.id, false),
      error: () => {
        this.marcarPendiente(cliente.id, false);
        this.aplicarFavoritoLocal(cliente.id, eraFavorito);
        this.aviso.set('No se pudo actualizar el favorito. Intenta de nuevo.');
        if (this.soloFavoritos() && eraFavorito) {
          // Si falló el desmarcado en la vista "Solo favoritos", la fila debe seguir visible —
          // revertir el Set ya lo garantiza, no hace falta recargar el listado.
          return;
        }
      },
    });
  }

  private aplicarFavoritoLocal(clientId: string, esFavorito: boolean): void {
    const actual = new Set(this.favoritos());
    if (esFavorito) actual.add(clientId);
    else actual.delete(clientId);
    this.favoritos.set(actual);
  }

  private marcarPendiente(clientId: string, pendiente: boolean): void {
    const actual = new Set(this.favoritosPendientes());
    if (pendiente) actual.add(clientId);
    else actual.delete(clientId);
    this.favoritosPendientes.set(actual);
  }

  /**
   * Reintentar NO repite una petición congelada: relee la URL en el momento de pulsarlo. Si el
   * usuario cambió los parámetros entretanto (botón atrás, edición manual), se pide lo que la URL
   * dice AHORA y no lo que falló antes.
   */
  reintentar(): void {
    this.recargar();
  }

  cerrarAviso(): void {
    this.aviso.set(null);
  }

  private recargar(): void {
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: {},
      queryParamsHandling: 'merge',
      onSameUrlNavigation: 'reload',
    });
  }

  private irA(cambios: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: cambios,
      queryParamsHandling: 'merge',
    });
  }

  // ── Lectura tolerante de la URL ───────────────────────────────────────────

  private numero(v: string | null, porDefecto: number): number {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 ? n : porDefecto;
  }

  /** Solo los tamaños que el contrato admite: pedir más de 50 es un 400 garantizado. */
  private tamanoValido(v: string | null): number {
    const n = Number(v);
    return (TAMANOS_DE_PAGINA as readonly number[]).includes(n) ? n : TAMANO_POR_DEFECTO;
  }
}
