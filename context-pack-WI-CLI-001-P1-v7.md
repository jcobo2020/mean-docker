# Context Pack · WI-CLI-001-P1 · [Backend] Clients — implementar endpoints — Parte 1
> Spec: MEAN-CLI-004 v8 (active) · Package: WP-CLI-001 · Rama: `feature/MEAN-CLI-004/WP-CLI-001`
> Tipo: backend · Riesgo: 18 · Pack determinista (Ola 4A) · hash `a0ffa924561f…`

## 1. Tarea

**[Backend] Clients — implementar endpoints — Parte 1**

Parte 1 de [Backend] Clients — implementar endpoints

Implementa EXACTAMENTE lo definido en §2 (contratos) respetando §4 (arquitectura y restricciones), §5 (transversales) y §10 (límites).
El §6 (estado actual del código) te dice qué existe YA en el repo: úsalo para calcular el delta — lo que la spec pide y no existe se CREA; lo que existe distinto se MODIFICA.
La Definition of Done (§8) es el criterio de cierre — no el "se ve bien".

**PRECEDENCIA (ante cualquier conflicto):** §2 + §10 definen el ALCANCE de este work item y mandan sobre todo lo demás. §4 y §7 describen el módulo/proyecto COMPLETO (todas las partes del package y olas futuras): si nombran endpoints, métodos, métricas o tests que §2 no autoriza, pertenecen a OTRA parte — **no los implementes, no los stubees y no preguntes por ellos**. §5 aplica completo a lo de §2. §6 es contexto de solo lectura.

## 2. Contratos (autoridad — no inventar campos ni códigos de estado)

### `POST /api/clients`
Crear cliente
- **Auth:** JWT bearer + rol admin (verificado CONTRA BD por middleware requireAdmin tras el JWT — el rol NO viaja en el token)
- **Body:**
  - `name`: string _(requerido)_ — 1..120
  - `email`: string _(requerido)_ — formato email, único; se NORMALIZA con trim + lowercase antes de validar, persistir y comparar unicidad (el unique de Mongo es case-sensitive)
  - `phone`: string — opcional; si viene debe cumplir E.164 estricto (regex ^\+[1-9]\d{1,14}$) → inválido = 400; ausente, null o string vacío '' se tratan como AUSENTE y no se persiste
- **Responses:**
  - `201` Cliente creado — envoltorio {status:'success', message, data}; data = cliente completo {id, name, email†, phone?†, status, createdAt, updatedAt} — †email/phone SIEMPRE ofuscados (lib interna api/src/lib/obfuscate, máscara 1er+último carácter visibles); id = string del ObjectId (no _id); phone solo si existe
  - `400` Validación — envoltorio {status:'error', message}
  - `409` Email duplicado — envoltorio {status:'error', message}
  - `401` Sin token — envoltorio {status:'error', message}
  - `403` Solicitante no tiene rol admin — envoltorio {status:'error', message}
- **AC-06** Creación de cliente restringida a admin — **Si** un usuario NO administrador envía POST /api/clients **entonces** responder 403 Forbidden
  - Regla **RN-06**: Solo un administrador puede crear clientes (POST /api/clients) · [authorization] · **Test esperado:** integration: POST /api/clients por usuario no-admin retorna 403

### `DELETE /api/clients/:id`
Desactivar cliente (soft-delete, solo admin)
- **Auth:** JWT bearer + rol admin (verificado CONTRA BD por middleware requireAdmin tras el JWT — el rol NO viaja en el token)
- **Params:**
  - `:id`: ObjectId _(requerido)_
- **Responses:**
  - `200` Soft-delete confirmado — envoltorio {status:'success', message, data}; mismo shape que el 201 con data.status='inactive' (evidencia del soft-delete), email/phone ofuscados. IDEMPOTENTE SIN WRITE: si el cliente ya está inactive NO se ejecuta ninguna escritura (updatedAt queda intacto) y se responde 200 con el documento tal cual (no es error)
  - `403` Sin rol admin — envoltorio {status:'error', message}
  - `404` No existe — envoltorio {status:'error', message}
  - `401` Sin token — envoltorio {status:'error', message}
  - `400` id no es un ObjectId válido — envoltorio {status:'error', message}
- **AC-04** Desactivación es soft-delete — **Cuando** un administrador ejecuta DELETE /api/clients/:id **entonces** marcar status=inactive sin borrar el registro y responder 200
  - Regla **RN-04**: La eliminación de clientes es lógica (soft-delete), nunca física · [workflow] · **Test esperado:** unit: delete marca inactive y conserva la fila · ⚠️ verificar ausencia de valores hardcodeados


## 3. Modelo de datos

### Entidad `Client`
- **Campos:** id ObjectId PK; name string(120); email string unique; phone string?; status enum active|inactive default active; createdAt/updatedAt timestamps; email y phone = PII (se devuelven SIEMPRE ofuscados, ver RN-07)
- **Relaciones:** ninguna en v1

### Otras entidades de la spec (contexto — pueden requerir cambios)
- **User**: MODELO EXISTENTE (api/src/models/user.ts) — AÑADIR role: enum 'admin'|'user' default 'user'; usuarios existentes sin role se tratan como 'user' (sin migración de datos)


## 4. Arquitectura y restricciones (de la spec)

_**Este work item cubre únicamente:** `POST /api/clients` · `DELETE /api/clients/:id`. Todo método, endpoint, métrica o test de §4 que NO toque esos contratos describe el módulo completo (otras partes del package u olas posteriores) — contexto, no alcance._

**Arquitectura [layered]:** Patrón layered NUEVO para este repo: router → controller delgado → service → model, aplicado ÚNICAMENTE al módulo Clients. ESTADO ACTUAL VERIFICADO del repo: los módulos existentes (User, Contact) son router → controller monolítico → model, SIN capa de servicio — no hay ningún módulo previo que siga el patrón layered; Clients lo estrena. NO se refactorizan User/Contact (única excepción: añadir el campo role al modelo User). Lógica de negocio de Clients en api/src/services/ClientService.ts (create, list, findById, deactivate — TODOS los endpoints de §2 pasan por el service); el controller solo traduce HTTP↔service. Ofuscación PII vía módulo interno universal api/src/lib/obfuscate. CONTRATO de obfuscate: obfuscateValue(value: unknown): unknown — string de longitud ≥3 → primer y último carácter visibles y el resto '*'; string de longitud 1-2 → todo '*'; string vacío ('') → se devuelve '' sin cambio (no es error); no-string (number/boolean/object/array) → se devuelve sin cambio; null/undefined → se devuelve tal cual. La máscara opera sobre PUNTOS DE CÓDIGO Unicode (Array.from), no bytes — strings con emoji/CJK se enmascaran por carácter percibido. toPublicClient(doc): opera sobre el objeto plano de doc.toObject({ virtuals: false }) y construye el shape público por WHITELIST explícita {id, name, email, phone?, status, createdAt, updatedAt} — cualquier campo adicional o virtual queda EXCLUIDO por construcción (id = string del ObjectId, sin __v ni internos) aplicando obfuscateValue SOLO a los campos marcados PII en el modelo de datos (email, phone). Determinista y sin efectos secundarios; unit tests obligatorios de todos los casos borde.

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
- **RN-07**: La PII de clientes (email, phone) se devuelve SIEMPRE ofuscada en las respuestas de la API (máscara: primer y último carácter visibles, resto *), vía módulo interno universal api/src/lib/obfuscate · [security] · **Test esperado:** unit: obfuscate enmascara strings (1er+último char) y deja no-strings/null intactos; integration: respuestas de clients devuelven email y phone ofuscados

Criterios transversales:
- **AC-03** Token requerido — **Si** se recibe cualquier request sin JWT válido **entonces** responder 401 Unauthorized

## 6. Estado actual del código (brownfield — lo que YA existe)

_Fuente: grafo de conocimiento del repositorio (ingeniería inversa del control plane)._
_Calcula el delta contra §2/§3: lo que la spec pide y no está aquí se CREA; lo que está distinto se MODIFICA. No reimplementes lo que ya existe._

### Modelos existentes
- **Contact** (`api/src/models/contact.ts`): firstName:String(req), lastName:String(req), mobile:String(req), email:String, city:String, postalCode:String, create_date:Date
- **User** (`api/src/models/user.ts`): firstName:String(req), lastName:String(req), username:String(req,unique), password:String(req), token:String, email:String, mobile:String, create_date:Date

### Endpoints existentes
`DELETE /api/contact/:contact_id` · `DELETE /api/users` · `DELETE /api/user/:user_id` · `GET /` · `GET /api/` · `GET /api/**` · `GET /api/contact/:contact_id` · `GET /api/contacts` · `GET /api/user/authenticate` · `GET /api/users` · `GET /api/user/:user_id` · `POST /api/contacts` · `POST /api/user/authenticate` · `POST /api/users` · `PUT /api/contact/:contact_id` · `PUT /api/user/changepassword/:user_id` · `PUT /api/users` · `PUT /api/user/:user_id`

### Stack y scripts detectados
- **contact-api-ts**: Mongoose · JWT, bcrypt · Swagger · Express — scripts npm: start, clean, build, dev, dev:watch, lint, test
- **contacts**: Angular SSR · Angular Router · Karma, Jasmine, Angular CLI · Angular

## 7. Convenciones del proyecto (specs contextuales activas)

_Aplican a TODO el código que escribas en este work item. No re-preguntes lo que esté definido aquí._

### MEAN-STD-001 — Convenciones de backend (contextual)
CONVENCIONES DE BACKEND (api/) — aplican a TODO módulo nuevo; los módulos legacy (User, Contact) NO se refactorizan para cumplirlas salvo que un work item lo autorice.

1) CADENA DE MIDDLEWARE Y PRECEDENCIA DE ERRORES: authenticate → autorización por rol (p.ej. requireAdmin) → validación de request → controller. Ante fallos múltiples gana el PRIMER eslabón: sin token o token inválido → 401; autenticado sin rol → 403 (aunque el body o el :id sean inválidos — un no-autorizado nunca sondea la validación); request inválido → 400. Los tests de 401/403 no dependen del body.

2) AUTENTICACIÓN: los módulos nuevos aceptan EXCLUSIVAMENTE 'Authorization: Bearer <jwt>'. El soporte legacy '?token=' que existe en middleware antiguo NO se propaga a rutas nuevas.

3) ENVOLTORIO DE RESPUESTA: éxito → {status:'success', message, data}; error → {status:'error', message}. Sin excepciones en módulos nuevos.

4) BOOTSTRAP TESTEABLE: la app Express se construye en una factoría exportable (createApp() en app.ts: middleware + rutas, SIN connect ni listen); server.ts solo hace connect a Mongo + app.listen. Extraer este patrón del server.ts monolítico actual está PERMITIDO y no cuenta como refactor prohibido de módulos legacy.

5) NORMALIZACIÓN DE EMAILS (módulos nuevos): trim + lowercase ANTES de validar, persistir y comparar unicidad — el índice unique de Mongo es case-sensitive y sin esto 'A@x.com' y 'a@x.com' serían dos registros.

6) TESTS: jest + ts-jest (unit) y supertest + mongodb-memory-server (integration, sin Docker) contra la app de createApp(). Los datos de arranque de los tests (p.ej. un usuario admin) se crean directamente en la BD en memoria. Los tests negativos NO sustituyen a los positivos.

7) LOGGING: seguir el estilo ya presente en los controllers del repo; no introducir stacks de logging/métricas nuevos salvo que un work item lo autorice (observabilidad tiene su propia ola).

8) FECHAS EN RESPUESTAS: createdAt/updatedAt se serializan en ISO 8601 UTC (comportamiento por defecto de JSON.stringify sobre Date) — no formatear manualmente.

9) CÓDIGOS DE ÉXITO: creación de recurso (POST que crea) → 201; el resto de operaciones exitosas (lecturas, updates, soft-deletes) → 200. En éxito, 'data' SIEMPRE está presente y nunca es null (si una operación no produce payload, no uses el envoltorio de éxito con data vacía: define el shape en el contrato del endpoint).

10) TOKEN EXPIRADO O INVÁLIDO: ambos casos responden 401 con el envoltorio de error estándar (mismo tratamiento — no revelar al cliente la diferencia); la distinción puede ir al log del servidor.

11) MANEJO GLOBAL DE ERRORES: createApp() registra al FINAL un error handler de Express que convierte cualquier excepción no controlada en 500 {status:'error', message:'Internal server error'} SIN filtrar stack ni detalles internos al cliente (el detalle va al log). server.ts registra handlers de process para unhandledRejection/uncaughtException que loguean y terminan el proceso de forma controlada.


## 8. Definition of Done

**Puertas de validación (obligatorias):**
- 🔒 [RN-03] integration: request sin token recibe 401
- 🔒 [RN-04] unit: delete marca inactive y conserva la fila
- 🔒 [RN-06] integration: POST /api/clients por usuario no-admin retorna 403

**Evidencia requerida al cerrar:**
- test_results: Tests unitarios passing

**Cobertura:** todos los criterios de §2 y §5 deben quedar verificados con tests, respetando las restricciones de §4.

**Autoridad del DoD:** las puertas de arriba + los criterios de §2/§5 son el cierre COMPLETO de este work item. §4 y §7 NO añaden alcance: si mencionan tests o flujos sobre endpoints fuera de §2, corresponden a otras partes del package.

## 10. Límites

- ❌ Endpoints/criterios de OTROS work items del package: no se tocan (partición del split).
- ⚠️ Si el contrato de §2 no define algo que necesitas (un campo, un código de estado, una validación), **PREGUNTA — no inventes**. La spec es la autoridad.
