# Context Pack · WI-CLI-001-P2 · [Backend] Clients — implementar endpoints — Parte 2

> Spec: MEAN-CLI-004 v8 (active) · Package: WP-CLI-001 · Rama: `feature/MEAN-CLI-004/WP-CLI-001`
> Tipo: backend · Riesgo: 18 · Pack determinista (Ola 4A) · hash `a0ffa924561f…`

## 1. Tarea

**[Backend] Clients — implementar endpoints — Parte 2**

Parte 2 de [Backend] Clients — implementar endpoints

Implementa EXACTAMENTE lo definido en §2 (contratos) respetando §4 (arquitectura y restricciones), §5 (transversales) y §10 (límites).
El §6 (estado actual del código) te dice qué existe YA en el repo: úsalo para calcular el delta — lo que la spec pide y no existe se CREA; lo que existe distinto se MODIFICA.
La Definition of Done (§8) es el criterio de cierre — no el "se ve bien".

**PRECEDENCIA (ante cualquier conflicto):** §2 + §10 definen el ALCANCE de este work item y mandan sobre todo lo demás. §4 y §7 describen el módulo/proyecto COMPLETO (todas las partes del package y olas futuras): si nombran endpoints, métodos, métricas o tests que §2 no autoriza, pertenecen a OTRA parte — **no los implementes, no los stubees y no preguntes por ellos**. §5 aplica completo a lo de §2. §6 es contexto de solo lectura.

## 2. Contratos (autoridad — no inventar campos ni códigos de estado)

### `GET /api/clients`

Listar clientes (solo activos por defecto; status=active explícito produce el mismo resultado que el default; status=inactive solo rol admin). ORDENACIÓN determinista: createdAt descendente, desempate por \_id descendente.

- **Auth:** JWT bearer
- **Query:**
  - `page`: number — min 1, default 1
  - `limit`: number — max 50, default 20
  - `status`: string — enum active|inactive — inactive solo rol admin
- **Responses:**
  - `200` Lista paginada — envoltorio {status:'success', message, data}; data = {items[], total, page, limit}; 'total' = conteo CON los filtros aplicados (no el global); email/phone ofuscados en cada item; orden: createdAt desc, \_id desc
  - `401` Sin token — envoltorio {status:'error', message}
  - `403` Filtro inactive sin rol admin — envoltorio {status:'error', message}
  - `400` Parámetros de paginación inválidos (page/limit no numéricos, page<1, limit<1 o limit>50) — envoltorio {status:'error', message}
- **AC-01** Listado por defecto devuelve solo activos — **Cuando** se recibe GET /api/clients sin parámetro status **entonces** devolver únicamente clientes con status=active, paginados — _GWT: dado existen clientes activos e inactivos, cuando consulto sin filtro, entonces solo recibo activos_
  - Regla **RN-01**: El listado por defecto excluye clientes inactivos · [validation] · **Test esperado:** integration: GET sin filtro no retorna inactivos · ⚠️ verificar ausencia de valores hardcodeados
- **AC-02** Solo admin puede ver inactivos — **Si** un usuario NO administrador envía status=inactive **entonces** responder 403 Forbidden con código CLIENTS_FORBIDDEN_FILTER
  - Regla **RN-02**: Solo el rol admin puede filtrar por status=inactive · [authorization] · **Test esperado:** integration: user normal con status=inactive recibe 403

### `GET /api/clients/:id`

Detalle de cliente. Devuelve 404 si el cliente es inactivo y el solicitante no es admin, o si :id no es un ObjectId válido

- **Auth:** JWT bearer
- **Params:**
  - `:id`: ObjectId _(requerido)_
- **Responses:**
  - `200` Cliente — envoltorio {status:'success', message, data}; data = cliente completo {id, name, email†, phone?†, status, createdAt, updatedAt} († ofuscado). INCLUYE clientes status='inactive' cuando el solicitante tiene rol admin (el 404 por inactivo aplica solo a no-admins)
  - `404` Cliente no existe, o es inactivo y el solicitante no es admin (mismo 404 para no revelar existencia) — envoltorio {status:'error', message}
  - `401` Sin token — envoltorio {status:'error', message}
  - `400` id no es un ObjectId válido — envoltorio {status:'error', message} (consistente con DELETE)
- **AC-05** Detalle de cliente inactivo oculto a no-admin — **Si** un usuario NO administrador solicita GET /api/clients/:id de un cliente con status=inactive **entonces** responder 404 Not Found (no revelar que el registro existe)
  - Regla **RN-05**: El detalle de un cliente (GET /:id) respeta la misma regla de visibilidad que el listado: si el cliente está inactivo y quien consulta no es administrador, se responde como si no existiera · [authorization] · **Test esperado:** integration: GET /api/clients/:id de un cliente inactivo por un usuario no-admin retorna 404 · ⚠️ verificar ausencia de valores hardcodeados

## 3. Modelo de datos

### Entidad `Client`

- **Campos:** id ObjectId PK; name string(120); email string unique; phone string?; status enum active|inactive default active; createdAt/updatedAt timestamps; email y phone = PII (se devuelven SIEMPRE ofuscados, ver RN-07)
- **Relaciones:** ninguna en v1

### Otras entidades de la spec (contexto — pueden requerir cambios)

- **User**: MODELO EXISTENTE (api/src/models/user.ts) — AÑADIR role: enum 'admin'|'user' default 'user'; usuarios existentes sin role se tratan como 'user' (sin migración de datos)

## 4. Arquitectura y restricciones (de la spec)

_**Este work item cubre únicamente:** `GET /api/clients` · `GET /api/clients/:id`. Todo método, endpoint, métrica o test de §4 que NO toque esos contratos describe el módulo completo (otras partes del package u olas posteriores) — contexto, no alcance._

**Arquitectura [layered]:** Patrón layered NUEVO para este repo: router → controller delgado → service → model, aplicado ÚNICAMENTE al módulo Clients. ESTADO ACTUAL VERIFICADO del repo: los módulos existentes (User, Contact) son router → controller monolítico → model, SIN capa de servicio — no hay ningún módulo previo que siga el patrón layered; Clients lo estrena. NO se refactorizan User/Contact (única excepción: añadir el campo role al modelo User). Lógica de negocio de Clients en api/src/services/ClientService.ts (create, list, findById, deactivate — TODOS los endpoints de §2 pasan por el service); el controller solo traduce HTTP↔service. Ofuscación PII vía módulo interno universal api/src/lib/obfuscate. CONTRATO de obfuscate: obfuscateValue(value: unknown): unknown — string de longitud ≥3 → primer y último carácter visibles y el resto '_'; string de longitud 1-2 → todo '_'; string vacío ('') → se devuelve '' sin cambio (no es error); no-string (number/boolean/object/array) → se devuelve sin cambio; null/undefined → se devuelve tal cual. La máscara opera sobre PUNTOS DE CÓDIGO Unicode (Array.from), no bytes — strings con emoji/CJK se enmascaran por carácter percibido. toPublicClient(doc): opera sobre el objeto plano de doc.toObject({ virtuals: false }) y construye el shape público por WHITELIST explícita {id, name, email, phone?, status, createdAt, updatedAt} — cualquier campo adicional o virtual queda EXCLUIDO por construcción (id = string del ObjectId, sin \_\_v ni internos) aplicando obfuscateValue SOLO a los campos marcados PII en el modelo de datos (email, phone). Determinista y sin efectos secundarios; unit tests obligatorios de todos los casos borde.

**Restricciones:**

- **testing**: Stack: jest + ts-jest + supertest + mongodb-memory-server (integration sin Docker); app Express exportable para los integration. Unit: ClientService (soft-delete marca inactive y conserva la fila) y lib obfuscate. Integration: rutas + auth (401 sin token, 403 no-admin) Y flujos positivos (POST 201 con shape completo y ofuscación verificada; GET detalle 200; DELETE 200 con status inactive; GET listado 200 con orden y paginación). Los tests negativos NO sustituyen a los positivos.
- **security**: JWT en todos los endpoints; filtro inactive y creación de clientes restringidos a rol admin; email nunca en logs. Rol admin verificado CONTRA BD: middleware requireAdmin (después del JWT) carga el usuario por req.user.id y exige role==='admin' (403 si no); el rol NO viaja en el JWT (evita tokens stale). El modelo User gana role: 'admin'|'user' default 'user'. PII (email/phone) SIEMPRE ofuscada en respuestas (RN-07). El 409 de email duplicado en POST /api/clients es un vector de enumeración de emails (ARCH-008): mitigar con rate limiting por IP/usuario en POST y GET (pendiente de definir límites exactos en Ola de seguridad — NO es DoD de los work items actuales). Si el JWT es válido pero req.user.id NO existe en BD (usuario eliminado tras emitir el token): responder 401 {status:'error', message} SIN escritura en BD — no existe fila que limpiar y el token deja de ser confiable; NO 403 (no hay identidad que autorizar) ni 500. BOOTSTRAP del primer admin: se provisiona manualmente (update directo en MongoDB o seed de desarrollo); NO existe endpoint para asignar roles (fuera de contrato). En tests de integración, crear usuarios admin/user directamente vía mongodb-memory-server.
- **performance**: listado paginado máx 50 (aplica a los endpoints GET); índice compound {status, createdAt} en el modelo Client — alineado al patrón dominante (filtro por status + orden por createdAt desc); email NO necesita índice adicional: ya lo tiene por la restricción unique. Índices aplican al work item que CREA el modelo
- **observability**: FUERA DEL ALCANCE de los work items actuales (Ola de observabilidad posterior): métrica clients_requests_total y log estructurado por request con userId. En los work items actuales: usar el estilo de logging ya presente en los controllers del repo, sin stack nuevo.

**Dependencias declaradas:**

- `mongoose` ^8 — ODM del modelo Client
- `express-validator` ^7 — validación de inputs
- `jest + ts-jest` ^29 — tests unit/integration (dev)
- `supertest` ^7 — integration HTTP contra app exportable (dev)
- `mongodb-memory-server` ^10 — MongoDB efímero para integration, sin Docker (dev)

## 5. Reglas transversales (aplican a TODO lo de §2)

- **RN-03**: Todos los endpoints requieren JWT válido · [authorization] · **Test esperado:** integration: request sin token recibe 401
- **RN-07**: La PII de clientes (email, phone) se devuelve SIEMPRE ofuscada en las respuestas de la API (máscara: primer y último carácter visibles, resto \*), vía módulo interno universal api/src/lib/obfuscate · [security] · **Test esperado:** unit: obfuscate enmascara strings (1er+último char) y deja no-strings/null intactos; integration: respuestas de clients devuelven email y phone ofuscados

Criterios transversales:

- **AC-03** Token requerido — **Si** se recibe cualquier request sin JWT válido **entonces** responder 401 Unauthorized

## 6. Estado actual del código (brownfield — lo que YA existe)

_Fuente: grafo de conocimiento del repositorio (ingeniería inversa del control plane)._
_Calcula el delta contra §2/§3: lo que la spec pide y no está aquí se CREA; lo que está distinto se MODIFICA. No reimplementes lo que ya existe._

### Modelos existentes

- **Client** (`api/src/models/client.ts`): name:String(req), email:String(req,unique), phone:String, status:String
- **Contact** (`api/src/models/contact.ts`): firstName:String(req), lastName:String(req), mobile:String(req), email:String, city:String, postalCode:String, create_date:Date
- **User** (`api/src/models/user.ts`): firstName:String(req), lastName:String(req), username:String(req,unique), password:String(req), token:String, email:String, mobile:String, role:String, create_date:Date

### Endpoints existentes

`DELETE /api/clients` · `DELETE /api/clients/:id` · `DELETE /api/contact/:contact_id` · `DELETE /api/users` · `DELETE /api/user/:user_id` · `GET /` · `GET /api/` · `GET /api/**` · `GET /api/contact/:contact_id` · `GET /api/contacts` · `GET /api/user/authenticate` · `GET /api/users` · `GET /api/user/:user_id` · `POST /api/clients` · `POST /api/contact/:contact_id` · `POST /api/contacts` · `POST /api/user/authenticate` · `POST /api/users` · `PUT /api/contact/:contact_id` · `PUT /api/user/changepassword/:user_id` · `PUT /api/users` · `PUT /api/user/:user_id`

### Stack y scripts detectados

- **contact-api-ts**: Mongoose · JWT, bcrypt · Swagger · Jest · Express — scripts npm: start, clean, build, dev, dev:watch, lint, test
- **contacts**: Angular SSR · Angular Router · Angular, Express — scripts npm: ng, start, serve, build, build:prod, watch, test, serve:ssr:contacts

## 6-bis. Estado de implementación del módulo (procedencia verificada)

_Fuente: reconciliación código↔spec del control plane — vínculos deterministas ancla↔código del último discovery. Presencia verificada, no supuesta._

### Ya implementado en el repo (por otros work items de esta spec) — REUTILIZAR, NO REIMPLEMENTAR

- ✓ `POST /api/clients` (endpoint) — commit `0fc49e9` · vía WI-CLI-001-P1
- ✓ `DELETE /api/clients/:id` (endpoint) — commit `0fc49e9` · vía WI-CLI-001-P1
- ✓ `Client` (entity) — commit `0fc49e9` · vía WI-CLI-001-P1

### Anchors de ESTE work item

- ✗ `GET /api/clients` (endpoint) — SIN evidencia en el código: lo creas TÚ en este work item
- ✗ `GET /api/clients/:id` (endpoint) — SIN evidencia en el código: lo creas TÚ en este work item
- ✓ `Client` (entity) — YA EXISTE (implementado por WI-CLI-001-P1): reutilízalo/extiéndelo según §2; NO lo recrees desde cero

### Directivas

- Todo lo marcado ✓ ya vive en el repo: reutiliza sus services, middlewares, validadores y helpers tal como están. NO los modifiques salvo que un contrato de §2 lo exija explícitamente.
- El alcance de este work item son ÚNICAMENTE sus anchors ✗ (más los cambios que §2 pida sobre los ✓). Nada fuera de eso.
- ⚠️ Las reglas transversales (§5) pueden estar implementadas SOLO en los caminos del código ✓ (p.ej. dentro de un middleware que tus endpoints nuevos no usan). Verifica que cada regla transversal quede cubierta TAMBIÉN en los anchors que tú creas — si un mecanismo existente no aplica a tu camino, extiéndelo o crea el equivalente siguiendo el mismo patrón.

## 7. Convenciones del proyecto (specs contextuales activas)

_Aplican a TODO el código que escribas en este work item. No re-preguntes lo que esté definido aquí._

### MEAN-STD-001 — Convenciones de backend (contextual)

CONVENCIONES DE BACKEND (api/) — aplican a TODO módulo nuevo; los módulos legacy (User, Contact) NO se refactorizan para cumplirlas salvo que un work item lo autorice.

1. CADENA DE MIDDLEWARE Y PRECEDENCIA DE ERRORES: authenticate → autorización por rol (p.ej. requireAdmin) → validación de request → controller. Ante fallos múltiples gana el PRIMER eslabón: sin token o token inválido → 401; autenticado sin rol → 403 (aunque el body o el :id sean inválidos — un no-autorizado nunca sondea la validación); request inválido → 400. Los tests de 401/403 no dependen del body.

2. AUTENTICACIÓN: los módulos nuevos aceptan EXCLUSIVAMENTE 'Authorization: Bearer <jwt>'. El soporte legacy '?token=' que existe en middleware antiguo NO se propaga a rutas nuevas.

3. ENVOLTORIO DE RESPUESTA: éxito → {status:'success', message, data}; error → {status:'error', message}. Sin excepciones en módulos nuevos.

4. BOOTSTRAP TESTEABLE: la app Express se construye en una factoría exportable (createApp() en app.ts: middleware + rutas, SIN connect ni listen); server.ts solo hace connect a Mongo + app.listen. Extraer este patrón del server.ts monolítico actual está PERMITIDO y no cuenta como refactor prohibido de módulos legacy.

5. NORMALIZACIÓN DE EMAILS (módulos nuevos): trim + lowercase ANTES de validar, persistir y comparar unicidad — el índice unique de Mongo es case-sensitive y sin esto 'A@x.com' y 'a@x.com' serían dos registros.

6. TESTS: jest + ts-jest (unit) y supertest + mongodb-memory-server (integration, sin Docker) contra la app de createApp(). Los datos de arranque de los tests (p.ej. un usuario admin) se crean directamente en la BD en memoria. Los tests negativos NO sustituyen a los positivos.

7. LOGGING: seguir el estilo ya presente en los controllers del repo; no introducir stacks de logging/métricas nuevos salvo que un work item lo autorice (observabilidad tiene su propia ola).

8. FECHAS EN RESPUESTAS: createdAt/updatedAt se serializan en ISO 8601 UTC (comportamiento por defecto de JSON.stringify sobre Date) — no formatear manualmente.

9. CÓDIGOS DE ÉXITO: creación de recurso (POST que crea) → 201; el resto de operaciones exitosas (lecturas, updates, soft-deletes) → 200. En éxito, 'data' SIEMPRE está presente y nunca es null (si una operación no produce payload, no uses el envoltorio de éxito con data vacía: define el shape en el contrato del endpoint).

10. TOKEN EXPIRADO O INVÁLIDO: ambos casos responden 401 con el envoltorio de error estándar (mismo tratamiento — no revelar al cliente la diferencia); la distinción puede ir al log del servidor.

11. MANEJO GLOBAL DE ERRORES: createApp() registra al FINAL un error handler de Express que convierte cualquier excepción no controlada en 500 {status:'error', message:'Internal server error'} SIN filtrar stack ni detalles internos al cliente (el detalle va al log). server.ts registra handlers de process para unhandledRejection/uncaughtException que loguean y terminan el proceso de forma controlada.

## 7-bis. Documentos adjuntos de la spec

### 📄 guia-implementacion-MEAN-CLI-004.md (resumen del context_compiler)

## Resumen normativo — MEAN-CLI-004 (API REST Gestión de Clientes)

### Endpoints y restricciones de acceso

| Endpoint                  | Auth JWT | Rol requerido     |
| ------------------------- | -------- | ----------------- |
| `GET /api/clients`        | ✓        | cualquier usuario |
| `GET /api/clients/:id`    | ✓        | cualquier usuario |
| `POST /api/clients`       | ✓        | `admin` only      |
| `DELETE /api/clients/:id` | ✓        | `admin` only      |

### Arquitectura obligatoria

- Patrón: `router → controller delgado → service → model` (nuevo; NO refactorizar User/Contact).
- Única modificación a módulos existentes: añadir campo `role` al modelo `User`.
- Soporte `?token=` **no se propaga** a módulos nuevos; solo `Authorization: Bearer`.

### Modelo de seguridad (orden estricto)

1. **JWT** — inválido/ausente → `401`.
2. **`requireAdmin` middleware** — verifica `role === 'admin'` **contra BD** (no desde claim JWT), usando `req.user.id`. No-admin → `403` **antes** de cualquier validación de request.
3. **Validación de request** — solo si pasaron capas 1 y 2.

**Caso borde crítico:** JWT válido pero `req.user.id` no existe en BD → `401` sin escritura en BD (no `403`, no `500`).

**Bootstrap admin:** solo por update directo en MongoDB o seed. No hay endpoint de asignación de roles.

### PII y privacidad (regla transversal RN-07)

- `email` y `phone` se devuelven **siempre ofuscados** en todas las respuestas.
- `email` **nunca** se escribe en logs.
- `409` por email duplicado es vector de enumeración (ARCH-008) → mitigación con rate limiting **fuera del DoD** (Ola de seguridad).

### Modelo de datos — Client

- Representa empresa/organización.
- Baja lógica: `DELETE` → `status = inactive`; **nunca borrado físico**.
- Segunda baja sobre cliente ya inactivo: idempotente, **sin escritura** (`updatedAt` no cambia).
- Listado por defecto excluye inactivos; solo `admin` puede pedir `status=inactive`.
- Índice compound `{status, createdAt}` obligatorio.
- `email` ya indexado por restricción `unique` (no añadir índice extra).
- Paginación: máximo **50 registros por página**.

### Estrategia de pruebas

- **Unit (jest + ts-jest):** `ClientService` (baja marca `inactive`, conserva fila) + librería de ofuscación.
- **Integration (supertest + mongodb-memory-server, sin Docker):** app Express exportable.
  - Negativos obligatorios: `401` sin token, `403` no-admin.
  - Positivos obligatorios: alta `201` (shape + ofuscación verificada), detalle `200`, baja `200` (`status=inactive`), listado con orden y paginación.
  - Los tests negativos **no sustituyen** a los positivos.
- Usuarios de prueba (admin/user) se crean directamente en BD en memoria.

### Fuera de alcance (no implementar)

- Métrica `clients_requests_total` y logging estructurado con `userId` → Ola de observabilidad.
- Rate limiting → Ola de seguridad.
- Endpoints de gestión de roles.
- Logging: usar estilo ya presente en controllers del repo, sin stack nuevo.

### 📄 decisiones-gobernanza-clients.md (completo)

# Decisiones de gobernanza — módulo Clients (MEAN-CLI-004)

> Resoluciones del arquitecto a ambigüedades detectadas durante la preparación de
> WI-CLI-001-P2. Complementan la spec sin modificarla (canal de adjuntos 4A.2).
> Aplican a TODOS los work items del módulo Clients, presentes y futuros.

## D1 — Dónde viven los códigos de error de negocio

El envoltorio de error del proyecto es EXACTAMENTE `{status:'error', message}` y no se
extiende con campos nuevos. Cuando un criterio de aceptación exige un código de error
(p.ej. `CLIENTS_FORBIDDEN_FILTER`), ese código ES el contenido del campo `message`,
literal y sin texto adicional: `{status:'error', message:'CLIENTS_FORBIDDEN_FILTER'}`.
Los tests de integración asertan ese literal.

## D2 — Valores inválidos en parámetros de query enumerables

Cualquier valor de un parámetro de query fuera de su dominio declarado (p.ej.
`status=foo` cuando el dominio es `active|inactive`) responde `400` con el envoltorio
estándar, usando el mismo mecanismo de validación que la paginación (express-validator,
enum). No se ignora el parámetro ni se aplica un default silencioso.

## D3 — Autorización condicional por filtro (status=inactive)

La cadena de middlewares de los GET es: `authenticate` → **gate condicional de rol** →
validación de parámetros → controller. El gate condicional es un middleware fino que
REUTILIZA el mecanismo de `requireAdmin` únicamente cuando `req.query.status === 'inactive'`;
en cualquier otro caso hace `next()` sin exigir rol. El `403` de ese gate usa
`message: 'CLIENTS_FORBIDDEN_FILTER'` (no el mensaje genérico de `requireAdmin`).
Consecuencia del orden: un request no-admin con `status=inactive` Y paginación inválida
recibe `403` (la autorización gana a la validación).

## D4 — JWT válido de usuario inexistente (regla transversal RN-03 en rutas de lectura)

La regla "JWT válido pero el usuario ya no existe en BD → 401" aplica a TODAS las rutas
del módulo, también las de lectura que no exigen admin. En las rutas GET se cubre con un
middleware post-`authenticate` que carga el usuario por `req.user.id` (401 con envoltorio
estándar si no existe) y deja `req.user.role` disponible para los pasos siguientes —
el gate de D3 y la visibilidad de inactivos (AC-05) usan ese `role` sin repetir la query.

## 8. Definition of Done

**Puertas de validación (obligatorias):**

- 🔒 [RN-01] integration: GET sin filtro no retorna inactivos
- 🔒 [RN-02] integration: user normal con status=inactive recibe 403
- 🔒 [RN-03] integration: request sin token recibe 401
- 🔒 [RN-05] integration: GET /api/clients/:id de un cliente inactivo por un usuario no-admin retorna 404

**Evidencia requerida al cerrar:**

- test_results: Tests unitarios passing

**Cobertura:** todos los criterios de §2 y §5 deben quedar verificados con tests, respetando las restricciones de §4.

**Autoridad del DoD:** las puertas de arriba + los criterios de §2/§5 son el cierre COMPLETO de este work item. §4 y §7 NO añaden alcance: si mencionan tests o flujos sobre endpoints fuera de §2, corresponden a otras partes del package.

## 10. Límites

- ❌ Endpoints/criterios de OTROS work items del package: no se tocan (partición del split).
- ⚠️ Si el contrato de §2 no define algo que necesitas (un campo, un código de estado, una validación), **PREGUNTA — no inventes**. La spec es la autoridad.
