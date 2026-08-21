// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]

/**
 * DOS formas para dos respuestas distintas, no una sola con campos opcionales.
 *
 * El contrato MEAN-CLI-004 no devuelve lo mismo en el listado que en el detalle: el detalle añade
 * `updatedAt`. Con un único tipo habría que marcarlo opcional, y entonces el compilador dejaría de
 * avisar cuando la ficha de detalle —donde SÍ está garantizado— lo tratara como ausente. Un
 * opcional que solo lo es en la mitad de los casos apaga la única comprobación gratuita que hay.
 */
export interface ClientSummary {
  id: string;
  name: string;
  /** Llega SIEMPRE ofuscado por el servidor (RN-07). Aquí no se des-ofusca nunca. */
  email: string;
  /** Ofuscado igual que el correo. Ausente cuando el cliente no tiene teléfono. */
  phone?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

/** Lo que devuelve el detalle: el resumen más la marca de última modificación. */
export interface Client extends ClientSummary {
  updatedAt: string;
}

/** Una página tal como la devuelve `GET /api/clients`. `total` viene YA con los filtros aplicados. */
export interface ClientPage {
  items: ClientSummary[];
  total: number;
  page: number;
  limit: number;
}

/**
 * El estado por el que se filtra. El contrato acepta `active` o `inactive` y devuelve SOLO los de
 * ese estado, así que no existe un valor que signifique «ambos»: el selector es excluyente.
 */
export type ClientStatusFilter = 'active' | 'inactive';

export interface ClientListQuery {
  page: number;
  limit: number;
  /** Ausente = comportamiento por defecto del contrato (solo activos), sin enviar el parámetro. */
  status?: ClientStatusFilter;
}

export interface CreateClientInput {
  name: string;
  email: string;
  /** Opcional. Si se deja vacío NO viaja: el contrato trata vacío, null y ausente como ausencia. */
  phone?: string;
}

/** Los tamaños de página que el contrato admite. Pedir más de 50 es un 400. */
export const TAMANOS_DE_PAGINA = [10, 20, 50] as const;
export const PAGINA_POR_DEFECTO = 1;
export const TAMANO_POR_DEFECTO = 20;
