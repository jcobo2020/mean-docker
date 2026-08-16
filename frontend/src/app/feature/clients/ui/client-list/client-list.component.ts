// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import {
  PAGINA_POR_DEFECTO,
  TAMANOS_DE_PAGINA,
  TAMANO_POR_DEFECTO,
  type ClientPage,
  type ClientStatusFilter,
} from '../../domain/models/client.model';
import { esErrorDeCliente, type AnyClientError } from '../../domain/errors/client.errors';
import { ListClientsUseCase } from '../../application/client.use-cases';

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
   * Distingue los DOS vacíos, porque no son la misma situación: sin filtros es «aún no hay nada» y
   * con filtro es «nada coincide». Un solo mensaje para ambos manda al usuario a buscar un problema
   * donde no lo hay.
   */
  readonly vacioPorFiltro = computed(
    () => this.estadoFiltro() === 'inactive' || this.paginaActual() > 1,
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

          if (this.pagina() === null) this.estado.set('cargando');
          else this.desactualizada.set(true);

          // `switchMap` cancela la petición anterior: sin él, una respuesta lenta de la página
          // previa puede pisar a la actual y mostrar datos que el usuario ya no pidió.
          return this.listar.execute({
            page: this.paginaActual(),
            limit: this.tamanoActual(),
            ...(this.estadoFiltro() === 'inactive' ? { status: 'inactive' as const } : {}),
          });
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
