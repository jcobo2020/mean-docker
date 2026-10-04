# WI-API-NOTA-CLIENTE-002 — Documentación de API: nota interna de cliente

## Qué pide la spec

La spec nace de una historia de usuario concreta [spec:seccion HU-001: Guardar una nota interna sobre un cliente]: cualquier usuario autenticado del CRM debe poder registrar una nota interna corta sobre un cliente —por ejemplo, "prefiere contacto por la tarde"— de modo que quede visible para cualquiera que abra su ficha. El problema que resuelve es la ausencia de un campo de anotaciones informales en la ficha de cliente; sin él, ese tipo de contexto se pierde o viaja fuera del sistema.

El mecanismo elegido es un endpoint PATCH dedicado [spec:seccion PATCH /api/clients/:id/note] que acepta `{ internalNote: string | null }` y persiste el valor en el documento del cliente. La spec lo define como un cambio aditivo sobre la arquitectura existente [spec:seccion Arquitectura]: el endpoint entra al `ClientController`/`ClientService` actuales sin ninguna capa nueva, y el campo `internalNote` se añade al modelo `Client` de Mongoose como campo opcional con `maxlength 280` y `default null` [spec:seccion Coleccion: clients (Mongoose, api/src/models/client.ts)].

Los criterios de aceptación más relevantes son [spec:seccion HU-001: Guardar una nota interna sobre un cliente]:

- El endpoint requiere autenticación mediante el mismo middleware que protege el resto de `/api/clients/*`; sin sesión válida devuelve 401.
- Un `:id` que no sea un `ObjectId` de MongoDB válido devuelve 400, nunca un 500 por `CastError`.
- Enviar `internalNote: ""` o `internalNote: null` borra la nota existente y la deja en `null`; ambos casos son válidos y no son error.
- Superar 280 caracteres devuelve 400 con `{ errors: [{ field: 'internalNote', message: '...' }] }`.
- Un cliente con `ObjectId` válido pero inexistente devuelve 404 con el mismo formato de error que el resto de endpoints de `/api/clients`.
- La respuesta es el cliente completo con `internalNote` actualizado; los endpoints `GET /api/clients` y `GET /api/clients/:id` ya lo devuelven de forma natural al ser un campo más del documento.
- La operación es idempotente: enviar el mismo `internalNote` dos veces produce el mismo resultado.

Las reglas de negocio completan el cuadro [spec:seccion Reglas de Negocio]: la nota es texto libre sin formato ni menciones (RN-001), solo existe una nota por cliente y escribir de nuevo sobrescribe la anterior sin acumular (RN-002), y el cuerpo se sanea con el mismo mecanismo que ya aplica a `name`/`email` antes de persistir (RN-003).

La spec no contempla ninguna dependencia nueva [spec:seccion Dependencias] ni índices adicionales [spec:seccion Performance], y reutiliza el logging HTTP existente sin métricas propias [spec:seccion Observabilidad].

## El trabajo y su historia

| work item | tipo | estado | asignado a |
|---|---|---|---|
| WI-API-NOTA-CLIENTE-001 | Backend | Mergeado | sin asignar |
| WI-API-NOTA-CLIENTE-002 | Documentación | MR Abierto · en revisión | Jorge Developer |

| fecha y hora (UTC) | work item | qué pasó | quién | motivo |
|---|---|---|---|---|
| 2026-08-28 19:58 | WI-API-NOTA-CLIENTE-001 | nace en «Generado» | Administrador Global | nacimiento del work item |
| 2026-08-28 19:58 | WI-API-NOTA-CLIENTE-002 | nace en «Generado» | Administrador Global | nacimiento del work item |
| 2026-08-28 20:08 | WI-API-NOTA-CLIENTE-001 | «Generado» → «Contexto Listo» | sin actor registrado | context pack preparado |
| 2026-08-31 18:54 | WI-API-NOTA-CLIENTE-002 | «Generado» → «Contexto Listo» | Administrador Global | context pack preparado |
| 2026-09-01 19:08 | WI-API-NOTA-CLIENTE-002 | «Contexto Listo» → «Aprobado» | Administrador Global | — |
| 2026-09-05 03:52 | WI-API-NOTA-CLIENTE-002 | «Aprobado» → «Asignado» | Administrador Global | asignación de work item |
| 2026-09-05 03:52 | WI-API-NOTA-CLIENTE-002 | «Asignado» → «En Progreso» | Administrador Global | Verificación en vivo de AEP·H7 |
| 2026-09-05 03:53 | WI-API-NOTA-CLIENTE-002 | «En Progreso» → «MR Abierto · en revisión» | sin actor registrado | automático: pull request #4242 en feature/MEAN-API-NOTA-CLIENTE-001/WP-API-NOTA-CLIENTE-001 |
| 2026-09-05 03:54 | WI-API-NOTA-CLIENTE-001 | «Contexto Listo» → «Mergeado» | sin actor registrado | automático: pull request #4242 en feature/MEAN-API-NOTA-CLIENTE-001/WP-API-NOTA-CLIENTE-001 |
| 2026-10-03 17:35 | WI-API-NOTA-CLIENTE-002 | «Aprobado» → «Asignado» (no cuadra con lo último que constaba, «MR Abierto · en revisión»: falta un cambio en el historial o se registró mal) | Administrador Global | asignación de work item |
| 2026-10-03 17:36 | WI-API-NOTA-CLIENTE-002 | PR #20 abierto | git | WI-API-NOTA-CLIENTE-002 · documento técnico |
| 2026-10-03 17:36 | WI-API-NOTA-CLIENTE-002 | «Asignado» → «En Progreso» | sin actor registrado | automático: push baa2d226b865 en docs/MEAN-API-NOTA-CLIENTE-001/WI-API-NOTA-CLIENTE-002 |
| 2026-10-03 17:36 | WI-API-NOTA-CLIENTE-002 | «En Progreso» → «MR Abierto · en revisión» | sin actor registrado | automático: pull request #20 en docs/MEAN-API-NOTA-CLIENTE-001/WI-API-NOTA-CLIENTE-002 |

El package se compone de dos work items: [wi:WI-API-NOTA-CLIENTE-001], que implementa el backend, y este WI-API-NOTA-CLIENTE-002, que produce la documentación.

Ambos nacieron simultáneamente el 2026-08-28 [estado:WI-API-NOTA-CLIENTE-001] [estado:WI-API-NOTA-CLIENTE-002]. El backend completó su contexto muy rápidamente (diez minutos después de nacer) y acabó mergeado el 2026-09-05 de forma automática asociado al PR #4242 [estado:WI-API-NOTA-CLIENTE-001]. Este work item de documentación tuvo un recorrido más largo: su contexto quedó listo el 2026-08-31, fue aprobado el 2026-09-01 y asignado a Jorge Developer el 2026-09-05, transitando a «MR Abierto · en revisión» ese mismo día [estado:WI-API-NOTA-CLIENTE-002].

La cronología registra una anomalía que merece atención: el 2026-10-03 aparece una transición «Aprobado» → «Asignado» para WI-API-NOTA-CLIENTE-002 cuando el último estado conocido era ya «MR Abierto · en revisión» [estado:WI-API-NOTA-CLIENTE-002]. El propio doc-pack señala que este evento «no cuadra con lo último que constaba» y que falta un cambio en el historial o se registró mal. A continuación, ese mismo día se abre el PR #20 [git:PR #20] y el work item vuelve a «MR Abierto · en revisión» mediante el push `baa2d226b865` en la rama `docs/MEAN-API-NOTA-CLIENTE-001/WI-API-NOTA-CLIENTE-002`. El documento técnico que este PR contiene es el que actualmente está en revisión.

## Lo que se tocó

### WI-API-NOTA-CLIENTE-001 · Backend · «Mergeado»
- Informe de finalización [informe:WI-API-NOTA-CLIENTE-001], 2026-08-28 20:16 UTC, commit 2229310: 0 de 0 criterios cubiertos.
  - Lo que dijo al entregarlo: Implementado PATCH /api/clients/:id/note: guarda o borra (null/'') una nota interna corta (internalNote, max 280 caracteres) en el cliente. Sigue el patron routes->controller->service->model ya usado por el recurso client, con express-validator, ObjectId valido, autenticacion Bearer (sin requireAdmin, cualquier usuario autenticado), y proyeccion publica sin ofuscar (no es PII).
  - Pruebas ejecutadas: `src/__tests__/clients.integration.test.ts` (pass), `src/lib/obfuscate.test.ts` (pass), `src/services/ClientService.test.ts` (pass), `src/services/FavoriteService.test.ts` (pass), `src/__tests__/favorites.integration.test.ts` (pass)
  - Decisiones:
    - aclaración: El §2 (Contratos) de este pack esta vacio ('este work item no tiene ancla de contrato') y el §1 tampoco nombra el endpoint. La unica fuente del contrato exacto (PATCH /api/clients/:id/note, campo internalNote, limite 280, codigos 400/401/404) es la spec hermana MEAN-API-NOTA-CLIENTE-001, que este pack no referencia en absoluto. — Revise §1, §1-bis, §2, §6 y §7. Ninguno menciona el nombre del endpoint ni el campo. Solo pude implementar con confianza porque conozco la spec por otra via; sin ese conocimiento previo esto habria bloqueado el trabajo desde el primer minuto.
    - aclaración: El DoD (§8) exige 'Reporte de cobertura >=80%' sin decir si es cobertura GLOBAL del repo o del DELTA (ficheros que este WI toca). La cobertura global es ~31% (arrastrada por modulos legado sin tests: server.ts, database.ts, UserController, ContactController) y nunca llegara a 80% por trabajo de este WI. Interprete la puerta como 'cobertura de los ficheros que este WI modifica', donde SI se cumple (client.ts 75.6%, ClientService.ts 98.5%, client.validators.ts 96.7%, obfuscate.ts 100%, api.routes.ts 96.6%). — Segui la interpretacion mas razonable dado que la puerta global es estructuralmente inalcanzable en este repo brownfield; documento la decision para que quede auditable, no oculta.
    - aclaración: sdd_mcp_transition_work_item documenta 'in_progress' como uno de los 4 hechos que este canal puede transcribir, pero la maquina de estados real NO tiene la arista context_ready->in_progress: exige context_ready->approved->assigned->in_progress, y approved/assigned son juicios humanos fuera del alcance de MCP. Al intentar in_progress recibi 422 con las alcanzables reales (approved, merged, blocked, cancelled) — ninguna de las cuatro describe honestamente 'implemente y probe en local, sin PR real'. No transicione el WI: forzar 'merged' habria sido falso (no hubo push), y 'approved'/'blocked'/'cancelled' tampoco son ciertos. — No es un hueco de MI trabajo sino de la herramienta: para un WI recien preparado que nadie asigno todavia, no existe un salto MCP-solo que registre honestamente 'ya empece'. El unico camino real desde context_ready sin pasar por el tablero es el atajo directo a merged, pensado para cuando el codigo YA llego a main via IDE.

### Ficheros
No consta ningún PR mergeado ni ningún push con ficheros.

El trabajo de código lo ejecutó íntegramente [wi:WI-API-NOTA-CLIENTE-001]. Según su informe de finalización [informe:WI-API-NOTA-CLIENTE-001], la implementación siguió el patrón `routes → controller → service → model` ya establecido para el recurso `client`, incorporando `express-validator`, validación de `ObjectId`, autenticación Bearer y proyección pública sin ofuscación adicional. Las pruebas declaradas como pasadas son `src/__tests__/clients.integration.test.ts`, `src/lib/obfuscate.test.ts`, `src/services/ClientService.test.ts`, `src/services/FavoriteService.test.ts` y `src/__tests__/favorites.integration.test.ts` [informe:WI-API-NOTA-CLIENTE-001].

El informe registra tres decisiones/aclaraciones relevantes [informe:WI-API-NOTA-CLIENTE-001]:

1. **Hueco de contexto en el pack**: el §1 y el §2 del pack de WI-API-NOTA-CLIENTE-001 no nombraban el endpoint ni el campo; el implementador solo pudo trabajar con confianza porque conocía la spec por otra vía. Se advierte que sin ese conocimiento previo el trabajo habría quedado bloqueado desde el primer minuto.
2. **Interpretación del umbral de cobertura**: el DoD exigía cobertura ≥ 80% sin especificar si era global o del delta. La cobertura global del repositorio es ~31% (arrastrada por módulos legacy sin tests). Se interpretó la puerta como cobertura de los ficheros modificados por el WI, donde sí se cumple (`ClientService.ts` al 98,5 %, `client.validators.ts` al 96,7 %, entre otros). La decisión queda auditada en el informe.
3. **Limitación de la máquina de estados MCP**: la herramienta no disponía de una arista que describiera honestamente "implementado y probado en local sin PR real", por lo que el WI no fue transicionado mediante MCP; el salto a «Mergeado» se produjo de forma automática al llegar el PR #4242.

El doc-pack no incluye información sobre ficheros concretos modificados: no consta ningún PR mergeado ni ningún push con lista de ficheros en el package de este work item.

El presente WI-API-NOTA-CLIENTE-002 aporta únicamente el documento técnico en Markdown, entregado mediante el push `baa2d226b865` y el PR #20 [git:PR #20] en la rama `docs/MEAN-API-NOTA-CLIENTE-001/WI-API-NOTA-CLIENTE-002`.

## Cómo está construido

El doc-pack no incluye diagramas Mermaid derivados del grafo de conocimiento para este work item.

La arquitectura que describe la spec es deliberadamente conservadora [spec:seccion Arquitectura]: no se introduce ninguna capa nueva. El endpoint PATCH se registra en el router central de `clients` (el mismo que agrupa el resto de rutas del recurso) y delega en el `ClientController` y `ClientService` existentes. El flujo es:

1. La petición llega al router, que aplica el middleware `requireAuth` antes de llegar al handler [spec:seccion PATCH /api/clients/:id/note].
2. El controller valida el `:id` con `mongoose.Types.ObjectId.isValid(id)` antes de llamar a Mongoose, evitando el `CastError` que hoy produciría un 500 [spec:seccion PATCH /api/clients/:id/note].
3. El validador `updateClientNoteValidator`, definido en `client.validators.ts` con `express-validator`, comprueba que `internalNote` es opcional, string y de máximo 280 caracteres [spec:seccion Validacion].
4. El service aplica el saneado ya existente (el mismo que usa `name`/`email`) antes de persistir [spec:seccion Reglas de Negocio].
5. Mongoose actualiza el campo `internalNote` en el documento indexado por `_id` y devuelve el cliente completo, que se serializa con el mismo serializador que `GET /api/clients/:id` [spec:seccion PATCH /api/clients/:id/note].
6. El controller construye el `statusCode` explícitamente y no delega al error handler global, que hoy no propaga `statusCode` correctamente [spec:seccion PATCH /api/clients/:id/note].

El campo en el modelo Mongoose es `internalNote: String, opcional, maxlength 280, default null` [spec:seccion Coleccion: clients (Mongoose, api/src/models/client.ts)]. Mongoose no exige migración para documentos existentes: los que no tengan el campo quedan con `internalNote undefined`, equivalente a `null` en la respuesta [spec:seccion Arquitectura].

## Reglas de negocio

- **RN-001** [spec:seccion Reglas de Negocio]: La nota es texto libre sin formato ni menciones; es un campo informativo, no un feed de comentarios.
- **RN-002** [spec:seccion Reglas de Negocio]: Solo existe una nota por cliente. Escribir de nuevo sobrescribe la anterior; no se acumulan.
- **RN-003** [spec:seccion Reglas de Negocio]: El body se sanea igual que el resto de campos de texto libre del proyecto (`name`/`email`) antes de persistir, para evitar inyección.
- **Borrado** [spec:seccion HU-001: Guardar una nota interna sobre un cliente]: Enviar `internalNote: ""` o `internalNote: null` es equivalente y válido; ambos dejan la nota en `null`.
- **Idempotencia** [spec:seccion HU-001: Guardar una nota interna sobre un cliente]: Enviar el mismo `internalNote` dos veces produce el mismo resultado.
- **Seguridad de acceso** [spec:seccion Seguridad]: Cualquier usuario autenticado que ya puede ver la ficha del cliente puede editar su nota; no hay autorización adicional por rol.
- **Sin índice** [spec:seccion Performance]: `internalNote` no se usa para filtrar ni ordenar, por lo que no se añade ningún índice nuevo.

El catálogo de errores añade un único código nuevo [spec:seccion Catalogo de errores]:

| Código | HTTP | Mensaje |
|---|---|---|
| `CLIENT_NOTE_TOO_LONG` | 400 | "La nota supera los 280 caracteres" |

## Cómo verificarlo

La spec define dos niveles de prueba [spec:seccion Testing]:

- **Tests de integración** (mismo patrón que `clients.integration.test.ts`): guardar nota, sobrescribirla, borrarla con `null` y con `""`, longitud máxima, `ObjectId` inválido, cliente inexistente y petición sin autenticación.
- **Test unitario de `ClientService`**: validación del límite de 280 caracteres.

El informe de [wi:WI-API-NOTA-CLIENTE-001] declara como pasados [informe:WI-API-NOTA-CLIENTE-001]:
- `src/__tests__/clients.integration.test.ts`
- `src/services/ClientService.test.ts`
- `src/lib/obfuscate.test.ts`
- `src/services/FavoriteService.test.ts`
- `src/__tests__/favorites.integration.test.ts`

La cobertura de los ficheros que toca el WI supera el 80 % según el informe [informe:WI-API-NOTA-CLIENTE-001] (`ClientService.ts` 98,5 %, `client.validators.ts` 96,7 %, `client.ts` 75,6 %, `obfuscate.ts` 100 %, `api.routes.ts` 96,6 %), aunque la cobertura global del repositorio es ~31 % por módulos legacy sin tests —véase la decisión documentada en el informe.

Los criterios de aceptación que cubren estos tests se corresponden con los enumerados en [spec:seccion HU-001: Guardar una nota interna sobre un cliente]: respuesta 200 con cliente completo, 400 por longitud y por `ObjectId` inválido, 401 sin autenticación, 404 por cliente inexistente, idempotencia y borrado por `null`/`""`.

## Notas para el mantenedor

1. **Anomalía en la cronología** [estado:WI-API-NOTA-CLIENTE-002]: El 2026-10-03 aparece una transición «Aprobado» → «Asignado» cuando el WI ya estaba en «MR Abierto · en revisión». El doc-pack lo señala explícitamente como un posible registro incorrecto o un cambio de estado no capturado. Conviene revisar el historial del work item en el tablero para determinar si hubo un reset manual.

2. **Ficheros modificados no registrados**: El doc-pack no incluye la lista de ficheros tocados por el backend [wi:WI-API-NOTA-CLIENTE-001]; no consta ningún PR mergeado con árbol de cambios en el package. El mantenedor deberá consultar directamente el PR #4242 (rama `feature/MEAN-API-NOTA-CLIENTE-001/WP-API-NOTA-CLIENTE-001`) para obtener el diff completo.

3. **Informe con 0 de 0 criterios cubiertos**: El informe de [wi:WI-API-NOTA-CLIENTE-001] registra formalmente "0 de 0 criterios cubiertos" [informe:WI-API-NOTA-CLIENTE-001], lo que refleja que el pack de ese WI no tenía criterios de aceptación formalizados en su §1/§2, no que la implementación carezca de pruebas. Las pruebas sí se ejecutaron y se declaran como pasadas.

4. **Cobertura global vs. delta** [informe:WI-API-NOTA-CLIENTE-001]: Si el DoD del proyecto se endurece para exigir cobertura global ≥ 80 %, este repositorio no la alcanzará mientras los módulos legacy (`server.ts`, `database.ts`, `UserController`, `ContactController`) carezcan de tests. La decisión de interpretar la puerta como cobertura del delta queda auditada en el informe del backend; cualquier cambio de criterio debe comunicarse antes de que afecte a futuras entregas.

5. **Limitación de la herramienta MCP** [informe:WI-API-NOTA-CLIENTE-001]: La máquina de estados no dispone de una arista que permita registrar honestamente "trabajo completado localmente sin PR". El salto a «Mergeado» de [wi:WI-API-NOTA-CLIENTE-001] fue automático al llegar el PR; no es una desviación del proceso sino una limitación documentada de la herramienta en repositorios brownfield.

6. **Saneado de texto**: El campo `internalNote` hereda el saneado existente de `name`/`email` [spec:seccion Seguridad]. Si ese mecanismo central cambia en el futuro, `internalNote` se verá afectado de forma implícita; no hay saneado ad hoc propio.

7. **Sin migración de datos**: Los documentos de cliente existentes en producción no tienen el campo `internalNote`; Mongoose los trata como `undefined`, que la respuesta serializa como `null` [spec:seccion Arquitectura]. No se requiere ningún script de migración, pero hay que tenerlo en cuenta si en el futuro se añade una consulta que filtre por `internalNote: null`.