// [AI-GENERATED | WI: WI-CLI-FRONT-001 | spec: MEAN-CLI-FRONT-001 | contrato: MEAN-CLI-004]

/**
 * Los errores de dominio del módulo Clients.
 *
 * POR QUÉ EXISTEN, y no se reacciona al código HTTP directamente: el número de estado es detalle
 * del transporte y solo lo conoce el adaptador. Los componentes reaccionan a estos tipos, que
 * dicen QUÉ pasó y traen lo que hace falta para presentarlo en el sitio correcto.
 *
 * Todos llevan un campo `kind` literal para que TypeScript los estreche en un `switch` y avise si
 * aparece uno nuevo sin tratar.
 *
 * NINGUNO lleva el valor tecleado por el usuario. Una versión anterior de la spec incluía el correo
 * intentado dentro del error de duplicado, y era una contradicción con su propia tesis —que el
 * correo es dato sensible y viaja siempre ofuscado— además de innecesaria: el formulario ya tiene
 * el valor en su control, y meterlo en un objeto de error lo arrastra a trazas y registros de fallo
 * donde no debe estar.
 */

export type ClientErrorKind =
  | 'not_found'
  | 'duplicate_email'
  | 'invalid_input'
  | 'forbidden'
  | 'infrastructure';

/** Acciones que el servidor puede rechazar por rol. Distinguirlas decide DÓNDE se pinta el aviso. */
export type ForbiddenAction = 'create' | 'deactivate' | 'filter_inactive';

abstract class ClientError extends Error {
  abstract readonly kind: ClientErrorKind;
  /** El texto crudo del envoltorio del servidor. Para diagnóstico: NUNCA se muestra tal cual. */
  readonly serverMessage: string | null;

  protected constructor(message: string, serverMessage: string | null) {
    super(message);
    this.serverMessage = serverMessage;
  }
}

export class ClientNotFoundError extends ClientError {
  readonly kind = 'not_found' as const;
  constructor(readonly id: string, serverMessage: string | null = null) {
    super(`Cliente ${id} no disponible`, serverMessage);
  }
}

export class DuplicateClientEmailError extends ClientError {
  readonly kind = 'duplicate_email' as const;
  /** Fijo a 'email': es lo que permite al formulario pintar el mensaje junto al control correcto
   *  sin adivinar por el texto del servidor. */
  readonly field = 'email' as const;
  constructor(serverMessage: string | null = null) {
    super('Ya existe un cliente con este correo', serverMessage);
  }
}

export class InvalidClientInputError extends ClientError {
  readonly kind = 'invalid_input' as const;
  /** Lista porque el 400 del contrato puede señalar más de un campo. Vacía cuando no identifica
   *  ninguno, y entonces el mensaje se muestra solo sobre el botón. */
  constructor(
    readonly fields: Array<{ field: string; reason: string }> = [],
    serverMessage: string | null = null,
  ) {
    super('Los datos enviados no son válidos', serverMessage);
  }
}

export class ForbiddenClientActionError extends ClientError {
  readonly kind = 'forbidden' as const;
  constructor(readonly action: ForbiddenAction, serverMessage: string | null = null) {
    super('No tienes permiso para esta acción', serverMessage);
  }
}

export class ClientInfrastructureError extends ClientError {
  readonly kind = 'infrastructure' as const;
  /** `true` literal: es la ÚNICA familia que ofrece reintento, y el tipo lo dice para que una
   *  pantalla no acabe ofreciendo reintentar un 409. */
  readonly retriable = true as const;
  /** `null` cuando no hubo respuesta (fallo de red), el código 5xx cuando la hubo. */
  constructor(readonly status: number | null, serverMessage: string | null = null) {
    super('No se pudo completar la operación', serverMessage);
  }
}

export type AnyClientError =
  | ClientNotFoundError
  | DuplicateClientEmailError
  | InvalidClientInputError
  | ForbiddenClientActionError
  | ClientInfrastructureError;

/** Discrimina un error de dominio de cualquier otra cosa que pueda llegar por el flujo. */
export function esErrorDeCliente(e: unknown): e is AnyClientError {
  return e instanceof Error && typeof (e as { kind?: unknown }).kind === 'string';
}
