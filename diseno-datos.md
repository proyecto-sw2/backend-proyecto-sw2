# Diseño de Datos — back-proy-sw1

> Generado a partir de las entidades TypeORM del proyecto NestJS.  
> Motor: **PostgreSQL** · ORM: **TypeORM**

---

## Diagrama de relaciones (resumen)

```
users ──< consultas
users ──< incidentes_mapa ──< publicaciones ──< comentarios
users ──< publicaciones
users ──< comentarios
users ──< emergency_contacts
users ──< emergency_alerts
comentarios ──< comentarios  (auto-referencia: respuestas)
```

---

## 1. `users`

Tabla principal de usuarios de la aplicación.

| Columna      | Tipo              | Restricciones                    | Descripción                             |
|--------------|-------------------|----------------------------------|-----------------------------------------|
| `id`         | `integer`         | PK, auto-increment               | Identificador único                     |
| `name`       | `varchar(100)`    | NOT NULL                         | Nombre completo del usuario             |
| `email`      | `varchar(100)`    | NOT NULL, UNIQUE                 | Correo electrónico                      |
| `password`   | `varchar(255)`    | nullable, oculto en SELECT       | Contraseña hasheada                     |
| `dispositivo`| `text`            | nullable                         | Identificador único del dispositivo     |
| `createdAt`  | `timestamp`       | auto (CREATE)                    | Fecha de creación                       |
| `updatedAt`  | `timestamp`       | auto (UPDATE)                    | Última actualización                    |
| `deletedAt`  | `timestamp`       | nullable — soft delete           | Fecha de borrado lógico                 |

**Relaciones (1:N hacia)**
- `consultas.usuario_id`
- `incidentes_mapa.usuario_id`
- `publicaciones.usuario_id`
- `comentarios.usuario_id`
- `emergency_contacts.userId`
- `emergency_alerts.userId`

---

## 2. `consultas`

Historial de consultas legales realizadas al chatbot (texto o voz).

| Columna         | Tipo       | Restricciones       | Descripción                                |
|-----------------|------------|---------------------|--------------------------------------------|
| `id_consulta`   | `integer`  | PK, auto-increment  | Identificador único                        |
| `usuario_id`    | `integer`  | FK → `users.id`     | Usuario que realizó la consulta            |
| `tipo_consulta` | `enum`     | NOT NULL            | `'texto'` \| `'voz'`                       |
| `contenido`     | `text`     | NOT NULL            | Pregunta o transcripción de voz            |
| `respuesta`     | `text`     | NOT NULL            | Respuesta generada por la IA               |
| `fecha_consulta`| `timestamp`| auto (CREATE)       | Fecha y hora de la consulta                |

---

## 3. `incidentes_mapa`

Reportes de incidentes geolocalizados publicados por usuarios, con trazabilidad blockchain.

| Columna              | Tipo           | Restricciones                          | Descripción                                                  |
|----------------------|----------------|----------------------------------------|--------------------------------------------------------------|
| `id_incidente`       | `integer`      | PK, auto-increment                     | Identificador único                                          |
| `usuario_id`         | `integer`      | FK → `users.id`                        | Usuario que reportó el incidente                             |
| `tipo_incidente`     | `varchar(100)` | NOT NULL                               | Categoría del incidente (accidente, bache, etc.)             |
| `descripcion`        | `text`         | NOT NULL                               | Detalle del incidente                                        |
| `latitud_longitud`   | `varchar(100)` | NOT NULL                               | Coordenadas en formato `"lat,lng"` (ej. `"-16.5,-68.11"`)   |
| `fecha_incidente`    | `timestamp`    | auto (CREATE)                          | Fecha y hora del reporte                                     |
| `doc_hash`           | `varchar(64)`  | nullable                               | SHA-256 del contenido del incidente                          |
| `tx_hash`            | `varchar(66)`  | nullable                               | Hash de transacción en Sepolia (`0x…`)                       |
| `blockchain_status`  | `varchar(20)`  | nullable, default `'sin_registro'`     | `'sin_registro'` \| `'pendiente'` \| `'confirmado'` \| `'fallido'` |

---

## 4. `publicaciones`

Publicaciones de la comunidad, opcionalmente asociadas a un incidente del mapa.

| Columna              | Tipo           | Restricciones                          | Descripción                                       |
|----------------------|----------------|----------------------------------------|---------------------------------------------------|
| `id_publicacion`     | `integer`      | PK, auto-increment                     | Identificador único                               |
| `usuario_id`         | `integer`      | FK → `users.id`                        | Autor de la publicación                           |
| `incidente_id`       | `integer`      | FK → `incidentes_mapa.id_incidente`, nullable | Incidente asociado (opcional)              |
| `contenido_texto`    | `text`         | nullable                               | Cuerpo de texto de la publicación                 |
| `ruta_media`         | `varchar(500)` | nullable                               | Ruta o URL del archivo multimedia adjunto         |
| `estado_revision`    | `enum`         | NOT NULL, default `'pendiente'`        | `'pendiente'` \| `'aprobado'` \| `'rechazado'`    |
| `fecha_publicacion`  | `timestamp`    | auto (CREATE)                          | Fecha de creación                                 |
| `fecha_actualizacion`| `timestamp`    | auto (UPDATE)                          | Última modificación                               |

---

## 5. `comentarios`

Comentarios y respuestas anidadas sobre publicaciones, con moderación IA.

| Columna              | Tipo      | Restricciones                                 | Descripción                                          |
|----------------------|-----------|-----------------------------------------------|------------------------------------------------------|
| `id_comentario`      | `integer` | PK, auto-increment                            | Identificador único                                  |
| `publicacion_id`     | `integer` | FK → `publicaciones.id_publicacion`           | Publicación a la que pertenece el comentario         |
| `usuario_id`         | `integer` | FK → `users.id`                               | Autor del comentario                                 |
| `comentario_padre_id`| `integer` | FK → `comentarios.id_comentario`, nullable    | Comentario padre (auto-referencia para respuestas)   |
| `contenido_texto`    | `text`    | NOT NULL                                      | Texto del comentario                                 |
| `estado_revision`    | `enum`    | NOT NULL, default `'pendiente'`               | `'pendiente'` \| `'aprobado'` \| `'rechazado'`       |
| `fecha_comentario`   | `timestamp`| auto (CREATE)                                | Fecha de creación                                    |
| `fecha_actualizacion`| `timestamp`| auto (UPDATE)                                | Última modificación                                  |

---

## 6. `emergency_contacts`

Contactos de emergencia registrados por cada usuario (a quiénes notificar en caso de alerta).

| Columna        | Tipo           | Restricciones                   | Descripción                                          |
|----------------|----------------|---------------------------------|------------------------------------------------------|
| `id`           | `integer`      | PK, auto-increment              | Identificador único                                  |
| `userId`       | `integer`      | FK → `users.id`, CASCADE DELETE | Propietario del contacto                             |
| `name`         | `varchar(100)` | NOT NULL                        | Nombre del contacto                                  |
| `phone`        | `varchar(20)`  | NOT NULL                        | Teléfono (WhatsApp)                                  |
| `email`        | `varchar(100)` | nullable                        | Correo electrónico del contacto                      |
| `fcmToken`     | `varchar(255)` | nullable                        | Token Firebase Cloud Messaging para push             |
| `relationship` | `varchar(50)`  | nullable                        | Relación (`'familia'`, `'amigo'`, `'trabajo'`, etc.) |
| `isActive`     | `boolean`      | NOT NULL, default `true`        | Si el contacto está activo                           |
| `priority`     | `integer`      | NOT NULL, default `1`           | Prioridad 1–5 (1 = más importante)                   |
| `createdAt`    | `timestamp`    | auto (CREATE)                   | Fecha de creación                                    |
| `updatedAt`    | `timestamp`    | auto (UPDATE)                   | Última actualización                                 |
| `deletedAt`    | `timestamp`    | nullable — soft delete          | Fecha de borrado lógico                              |

---

## 7. `emergency_alerts`

Alertas de emergencia activadas por el usuario (botón de pánico), con evidencias y registro blockchain.

| Columna            | Tipo              | Restricciones                          | Descripción                                                          |
|--------------------|-------------------|----------------------------------------|----------------------------------------------------------------------|
| `id`               | `integer`         | PK, auto-increment                     | Identificador único                                                  |
| `userId`           | `integer`         | FK → `users.id`, CASCADE DELETE        | Usuario que activó la alerta                                         |
| `type`             | `enum`            | NOT NULL, default `'panic_button'`     | `'panic_button'` \| `'automatic_detection'` \| `'manual_trigger'`   |
| `status`           | `enum`            | NOT NULL, default `'active'`           | `'active'` \| `'resolved'` \| `'false_alarm'`                        |
| `description`      | `text`            | nullable                               | Descripción textual de la emergencia                                 |
| `latitude`         | `decimal(10,8)`   | nullable                               | Latitud GPS                                                          |
| `longitude`        | `decimal(11,8)`   | nullable                               | Longitud GPS                                                         |
| `location`         | `varchar(255)`    | nullable                               | Dirección aproximada legible                                         |
| `videoUrl`         | `varchar(255)`    | nullable                               | URL del video en AWS S3                                              |
| `audioUrl`         | `varchar(255)`    | nullable                               | URL del audio en AWS S3                                              |
| `duration`         | `integer`         | NOT NULL, default `0`                  | Duración del video/audio en segundos                                 |
| `metadata`         | `jsonb`           | nullable                               | Datos adicionales (acelerómetro, sensor, etc.)                       |
| `doc_hash`         | `varchar(64)`     | nullable                               | SHA-256 de los metadatos de la evidencia                             |
| `tx_hash`          | `varchar(66)`     | nullable                               | Hash de transacción en Sepolia (`0x…`)                               |
| `blockchain_status`| `varchar(20)`     | nullable, default `'sin_registro'`     | `'sin_registro'` \| `'pendiente'` \| `'confirmado'` \| `'fallido'`  |
| `resolvedAt`       | `timestamp`       | nullable                               | Fecha en que se resolvió la alerta                                   |
| `resolutionNotes`  | `text`            | nullable                               | Notas de resolución                                                  |
| `createdAt`        | `timestamp`       | auto (CREATE)                          | Fecha de creación                                                    |
| `updatedAt`        | `timestamp`       | auto (UPDATE)                          | Última actualización                                                 |
| `deletedAt`        | `timestamp`       | nullable — soft delete                 | Fecha de borrado lógico                                              |

---

## Enumeraciones

| Enum             | Valores                                                    | Usada en                            |
|------------------|------------------------------------------------------------|-------------------------------------|
| `AlertType`      | `panic_button`, `automatic_detection`, `manual_trigger`    | `emergency_alerts.type`             |
| `AlertStatus`    | `active`, `resolved`, `false_alarm`                        | `emergency_alerts.status`           |
| `EstadoRevision` | `pendiente`, `aprobado`, `rechazado`                       | `publicaciones.estado_revision`, `comentarios.estado_revision` |
| `TipoConsulta`   | `texto`, `voz`                                             | `consultas.tipo_consulta`           |

---

## Notas sobre blockchain

Las tablas `incidentes_mapa` y `emergency_alerts` comparten el mismo patrón de trazabilidad:

| Campo               | Descripción                                                          |
|---------------------|----------------------------------------------------------------------|
| `doc_hash`          | SHA-256 calculado en el backend antes de firmar la transacción       |
| `tx_hash`           | Hash devuelto por Sepolia testnet tras confirmar la transacción      |
| `blockchain_status` | Estado actualizado asincrónicamente; nunca bloquea la respuesta HTTP |

