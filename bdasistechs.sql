-- =====================================================================
-- ASISTECH - Base de datos asistech (MySQL 8.0.16 o superior)
-- Parte de Marcos: tablas, vistas y accesos.
--
-- Cómo ejecutarlo:
-- HeidiSQL > Consulta > pegar todo > F9.
-- DBeaver > Editor SQL > pegar todo > Alt+X.
--
-- Puede ejecutarse varias veces sin duplicar los estudiantes de prueba.
-- Las tablas existentes conservan su estructura y sus registros.
-- Las vistas se reemplazan con las definiciones de este script.
--
-- Contenido:
--   0. Base de datos asistech
--   1. asistencia_nfc: marcajes recibidos por la API
--   2. estudiante: asignación de tarjetas NFC
--   3. alerta_ia: alertas del modelo de IA
--   4. vw_lecturas_hoy / vw_alertas_abiertas
--   5. Estudiantes de prueba
--   6. Consultas de verificación
--   7. Accesos opcionales
--   8. Limpieza opcional de estudiantes de prueba
--   9. Gestión académica y roles (establecimiento, rol, ciclo_escolar, grado, seccion, grado_seccion y alter tables)
--
-- IMPORTANTE:
-- Usar siempre el nombre "asistech" en este script, en DB_NAME del .env
-- y en consultas con prefijo, por ejemplo: asistech.asistencia_nfc.
--
-- Este script supone que la tabla asistencia_nfc existente ya incluye
-- id_evento CHAR(36) NOT NULL y su restricción UNIQUE.
-- CREATE TABLE IF NOT EXISTS no agrega columnas a una tabla existente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Base de datos
-- ---------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS asistech
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE asistech;

-- ---------------------------------------------------------------------
-- 1. Tabla de marcajes NFC
--
-- Si la tabla ya existe, esta sentencia no la modifica.
-- fecha_hora se guarda en UTC por convención de la API.
-- id_evento identifica cada evento y evita insertar el mismo evento
-- más de una vez.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS asistencia_nfc (
    id_registro BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_evento CHAR(36) NOT NULL,
    uid_nfc VARCHAR(100) NOT NULL,
    id_establecimiento INT UNSIGNED NOT NULL,
    fecha_hora DATETIME NOT NULL COMMENT 'Hora del marcaje en UTC',
    tipo_registro ENUM('ENTRADA', 'SALIDA') NOT NULL,
    recibido_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_asistencia_id_evento UNIQUE (id_evento),

    INDEX idx_uid_fecha (uid_nfc, fecha_hora),
    INDEX idx_establecimiento_fecha (id_establecimiento, fecha_hora)
);

-- ---------------------------------------------------------------------
-- 2. Estudiantes y asignación de tarjetas
--
-- uid_nfc es único: una tarjeta pertenece a un solo estudiante.
-- Usar el formato acordado por Juan y Emanuel:
-- hexadecimal en mayúsculas, sin separadores.
-- Ejemplo: 04A1B2C3D4.
--
-- Normalizar el UID en la aplicación antes de guardarlo o consultarlo.
-- activo: 1 = activo, 0 = inactivo.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS estudiante (
    id_estudiante INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uid_nfc VARCHAR(100) NOT NULL,
    nombre VARCHAR(120) NOT NULL,
    grado VARCHAR(40) NULL,
    seccion VARCHAR(10) NULL,
    id_establecimiento INT UNSIGNED NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_estudiante_uid UNIQUE (uid_nfc),

    INDEX idx_estudiante_estab (id_establecimiento, activo)
);

-- ---------------------------------------------------------------------
-- 3. Alertas del modelo de IA
--
-- Las escribe el proceso de IA.
-- Ejemplos de tipo:
-- ausencias_recurrentes, tardanzas_crecientes, lectura_duplicada, otro.
--
-- puntaje: valor entre 0.000 y 1.000.
-- revisada: 0 = pendiente, 1 = revisada.
-- revisada_en: fecha y hora de revisión.
--
-- ON DELETE CASCADE:
-- eliminar un estudiante también elimina sus alertas.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alerta_ia (
    id_alerta BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT UNSIGNED NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    severidad ENUM('alta', 'media', 'baja') NOT NULL,
    puntaje DECIMAL(4,3) NOT NULL,
    descripcion TEXT NOT NULL,
    creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revisada TINYINT(1) NOT NULL DEFAULT 0,
    revisada_en TIMESTAMP NULL DEFAULT NULL,

    CONSTRAINT fk_alerta_estudiante
        FOREIGN KEY (id_estudiante)
        REFERENCES estudiante (id_estudiante)
        ON DELETE CASCADE,

    CONSTRAINT ck_alerta_puntaje
        CHECK (puntaje BETWEEN 0 AND 1),

    INDEX idx_alerta_abiertas (revisada, creada_en)
);

-- ---------------------------------------------------------------------
-- 4. Usuarios del sistema (Acceso y Seguridad al Dashboard)
--
-- usuario: identificador único para iniciar sesión.
-- contrasena: contraseña del usuario para autenticación.
-- confirmar_contrasena: confirmación de contraseña.
-- estado: 1 = activo (puede iniciar sesión), 0 = inactivo (bloqueado).
-- creado_en / actualizado_en: control de auditoría de registros.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usuario (
    id_usuario INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(60) NOT NULL,
    apellido VARCHAR(60) NOT NULL,
    usuario VARCHAR(50) NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    confirmar_contrasena VARCHAR(255) NOT NULL,
    estado TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = Activo, 0 = Inactivo',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT uq_usuario_login UNIQUE (usuario),
    INDEX idx_usuario_estado (usuario, estado)
);

-- Agregar usuario de prueba para login
-- Usuario: admin
-- Contraseña: Demo#2026
INSERT IGNORE INTO usuario (
    nombre,
    apellido,
    usuario,
    contrasena,
    confirmar_contrasena,
    estado
)
VALUES (
    'Emanuel',
    'Baltazar',
    'admin',
    '$2b$12$nlKl7SW1xFXLDyObc1Qgy.P/VbBauOdjqhZAc6.RPcxjr/pf0A7za',
    '$2b$12$nlKl7SW1xFXLDyObc1Qgy.P/VbBauOdjqhZAc6.RPcxjr/pf0A7za',
    1
);


-- ---------------------------------------------------------------------
-- 5. Vistas
--
-- Guatemala utiliza UTC-6.
-- El día local comienza a las 06:00 UTC.
-- UTC_TIMESTAMP() permite calcular el día independientemente de la
-- zona horaria de la sesión.
--
-- fecha_hora: hora original del marcaje en UTC.
-- hora_guatemala: hora del marcaje convertida a UTC-6.
-- ---------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_lecturas_hoy AS
SELECT
    a.id_registro,
    a.id_evento,
    a.uid_nfc,
    a.id_establecimiento,
    a.tipo_registro,
    a.fecha_hora,
    DATE_SUB(a.fecha_hora, INTERVAL 6 HOUR) AS hora_guatemala,
    COALESCE(e.nombre, 'UID sin registrar') AS nombre,
    CONCAT_WS(' ', e.grado, e.seccion) AS grado
FROM asistencia_nfc AS a
LEFT JOIN estudiante AS e
    ON e.uid_nfc = a.uid_nfc
WHERE a.fecha_hora >= DATE_ADD(
    DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 HOUR)),
    INTERVAL 6 HOUR
)
AND a.fecha_hora < DATE_ADD(
    DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 HOUR)),
    INTERVAL 30 HOUR
);

-- Alertas que todavía no han sido revisadas.

CREATE OR REPLACE VIEW vw_alertas_abiertas AS
SELECT
    al.id_alerta,
    e.id_establecimiento,
    e.nombre,
    CONCAT_WS(' ', e.grado, e.seccion) AS grado,
    al.tipo,
    al.severidad,
    al.puntaje,
    al.descripcion,
    al.creada_en
FROM alerta_ia AS al
INNER JOIN estudiante AS e
    ON e.id_estudiante = al.id_estudiante
WHERE al.revisada = 0;

-- ---------------------------------------------------------------------
-- 5. Estudiantes de prueba
--
-- El primero utiliza el UID de ejemplo: 04A1B2C3D4.
-- INSERT IGNORE omite los UID que ya existen.
-- No actualiza los datos de estudiantes existentes.
--
-- Eliminar estos estudiantes cuando ya no sean necesarios.
-- ---------------------------------------------------------------------

INSERT IGNORE INTO estudiante (
    uid_nfc,
    nombre,
    grado,
    seccion,
    id_establecimiento
)
VALUES
    ('04A1B2C3D4', 'Estudiante de prueba 1', '1ro Básico', 'A', 1),
    ('04A1B2C3D5', 'Estudiante de prueba 2', '1ro Básico', 'A', 1),
    ('04A1B2C3D6', 'Estudiante de prueba 3', '2do Básico', 'B', 1);

-- ---------------------------------------------------------------------
-- 6. Verificación
-- Estas consultas solo muestran información.
-- ---------------------------------------------------------------------

-- Confirmar que existe la base de datos.

SHOW DATABASES LIKE 'asistech';

-- Mostrar las tres tablas y las dos vistas.

SHOW TABLES;

-- Revisar la estructura de la tabla de marcajes.

SHOW CREATE TABLE asistech.asistencia_nfc;

-- Mostrar los últimos diez marcajes.

SELECT *
FROM asistech.asistencia_nfc
ORDER BY id_registro DESC
LIMIT 10;

-- Contar los marcajes.
-- Este script no inserta ni elimina marcajes.

SELECT COUNT(*) AS total_registros
FROM asistech.asistencia_nfc;

-- Verificar los identificadores de eventos.

SELECT id_registro, id_evento, uid_nfc
FROM asistech.asistencia_nfc
ORDER BY id_registro DESC
LIMIT 10;

-- Mostrar estudiantes.

SELECT *
FROM asistech.estudiante;

-- Mostrar lecturas del día local con nombre y hora de Guatemala.

SELECT *
FROM asistech.vw_lecturas_hoy
ORDER BY fecha_hora DESC;

-- Mostrar alertas pendientes.

SELECT *
FROM asistech.vw_alertas_abiertas
ORDER BY creada_en DESC;

-- ---------------------------------------------------------------------
-- 7. Accesos opcionales
--
-- Ejecutar únicamente después de cambiar usuarios, claves y hosts.
-- Estas sentencias están comentadas para evitar su ejecución automática.
--
-- Limitar el host a la red o equipo que corresponda.
-- Entregar las claves por canal privado, nunca por Git.
-- CREATE USER IF NOT EXISTS no cambia la clave de un usuario existente.
-- ---------------------------------------------------------------------

-- Usuario de solo lectura para Marcos:

-- CREATE USER IF NOT EXISTS 'marcos'@'192.168.1.%'
--     IDENTIFIED BY 'CAMBIAR_CLAVE';

-- GRANT SELECT ON asistech.*
--     TO 'marcos'@'192.168.1.%';

-- Permisos del usuario existente de la API para registrar marcajes:

-- GRANT INSERT, SELECT ON asistech.asistencia_nfc
--     TO 'USUARIO_API'@'HOST_API';

-- Permisos de consulta para el dashboard:

-- GRANT SELECT ON asistech.estudiante
--     TO 'USUARIO_API'@'HOST_API';

-- GRANT SELECT ON asistech.vw_lecturas_hoy
--     TO 'USUARIO_API'@'HOST_API';

-- GRANT SELECT ON asistech.vw_alertas_abiertas
--     TO 'USUARIO_API'@'HOST_API';

-- GRANT SELECT ON asistech.alerta_ia
--     TO 'USUARIO_API'@'HOST_API';

-- Permitir revisar alertas modificando solo estas dos columnas:

-- GRANT UPDATE (revisada, revisada_en)
--     ON asistech.alerta_ia
--     TO 'USUARIO_API'@'HOST_API';

-- El usuario del proceso de IA necesita permisos para leer estudiantes
-- y marcajes, e insertar alertas. Sustituir sus datos antes de ejecutar:

-- GRANT SELECT ON asistech.estudiante
--     TO 'USUARIO_IA'@'HOST_IA';

-- GRANT SELECT ON asistech.asistencia_nfc
--     TO 'USUARIO_IA'@'HOST_IA';

-- GRANT INSERT ON asistech.alerta_ia
--     TO 'USUARIO_IA'@'HOST_IA';

-- ---------------------------------------------------------------------
-- 8. Limpieza opcional de estudiantes de prueba
--
-- Está comentada para evitar eliminar datos automáticamente.
-- También elimina las alertas de esos estudiantes por ON DELETE CASCADE.
-- No elimina los marcajes de asistencia_nfc.
-- ---------------------------------------------------------------------

-- DELETE FROM asistech.estudiante
-- WHERE nombre LIKE 'Estudiante de prueba%';

-- ---------------------------------------------------------------------
-- 9. Gestión Académica y Roles (Administrador, Ciclo Escolar, Grado, Sección y Estudiante)
--
-- Añade la estructura para el mantenimiento/CRUD de roles y de la estructura
-- académica organizativa:
--   - Rol: Permite definir roles como "Administrador" para el control de accesos.
--   - Establecimiento: Un establecimiento agrupa ciclos, grados, secciones y estudiantes.
--   - Ciclo Escolar: Creado por un Administrador para un establecimiento.
--   - Grado y Sección: Grados y secciones asociadas a un establecimiento.
--   - Grado_Seccion: Enlace/asignación de un grado con una sección dentro de un ciclo escolar.
--   - Alteraciones a usuario y estudiante para enlazar estas entidades.
-- ---------------------------------------------------------------------

-- 9.1. Tabla de Establecimientos
CREATE TABLE IF NOT EXISTS establecimiento (
    id_establecimiento INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    codigo VARCHAR(50) NULL,
    direccion VARCHAR(255) NULL,
    telefono VARCHAR(20) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_establecimiento_nombre UNIQUE (nombre)
);

-- Insertar establecimiento principal por defecto (ID 1 para mantener compatibilidad)
INSERT IGNORE INTO establecimiento (id_establecimiento, nombre)
VALUES (1, 'Establecimiento Principal');


-- 9.2. Tabla de Roles (CRUD de Roles)
CREATE TABLE IF NOT EXISTS rol (
    id_rol INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_rol_nombre UNIQUE (nombre)
);

-- Insertar rol Administrador por defecto
INSERT IGNORE INTO rol (id_rol, nombre, descripcion)
VALUES (1, 'Administrador', 'Rol de administración del sistema para gestionar Ciclos Escolares, Grados, Secciones y Estudiantes');


-- 9.3. Tabla de Ciclos Escolares
CREATE TABLE IF NOT EXISTS ciclo_escolar (
    id_ciclo_escolar INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT UNSIGNED NOT NULL,
    anio INT UNSIGNED NOT NULL,
    nombre VARCHAR(60) NOT NULL COMMENT 'Ejemplo: Ciclo Escolar 2026',
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    estado ENUM('activo', 'inactivo', 'cerrado') NOT NULL DEFAULT 'activo',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ciclo_establecimiento
        FOREIGN KEY (id_establecimiento)
        REFERENCES establecimiento (id_establecimiento)
        ON DELETE CASCADE,

    CONSTRAINT uq_ciclo_estab_anio UNIQUE (id_establecimiento, anio)
);

-- Insertar ciclo escolar por defecto
INSERT IGNORE INTO ciclo_escolar (id_ciclo_escolar, id_establecimiento, anio, nombre, estado)
VALUES (1, 1, 2026, 'Ciclo Escolar 2026', 'activo');


-- 9.4. Tabla de Grados
CREATE TABLE IF NOT EXISTS grado (
    id_grado INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT UNSIGNED NOT NULL,
    nombre VARCHAR(60) NOT NULL COMMENT 'Ejemplo: 1ro Básico, 2do Básico',
    descripcion VARCHAR(150) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_grado_establecimiento
        FOREIGN KEY (id_establecimiento)
        REFERENCES establecimiento (id_establecimiento)
        ON DELETE CASCADE,

    CONSTRAINT uq_grado_estab_nombre UNIQUE (id_establecimiento, nombre)
);

-- Insertar grados de ejemplo
INSERT IGNORE INTO grado (id_grado, id_establecimiento, nombre)
VALUES
    (1, 1, '1ro Básico'),
    (2, 1, '2do Básico');


-- 9.5. Tabla de Secciones
CREATE TABLE IF NOT EXISTS seccion (
    id_seccion INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT UNSIGNED NOT NULL,
    nombre VARCHAR(10) NOT NULL COMMENT 'Ejemplo: A, B, C',
    descripcion VARCHAR(150) NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_seccion_establecimiento
        FOREIGN KEY (id_establecimiento)
        REFERENCES establecimiento (id_establecimiento)
        ON DELETE CASCADE,

    CONSTRAINT uq_seccion_estab_nombre UNIQUE (id_establecimiento, nombre)
);

-- Insertar secciones de ejemplo
INSERT IGNORE INTO seccion (id_seccion, id_establecimiento, nombre)
VALUES
    (1, 1, 'A'),
    (2, 1, 'B');


-- 9.6. Tabla Enlace Grado - Sección por Ciclo Escolar
CREATE TABLE IF NOT EXISTS grado_seccion (
    id_grado_seccion INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_ciclo_escolar INT UNSIGNED NOT NULL,
    id_grado INT UNSIGNED NOT NULL,
    id_seccion INT UNSIGNED NOT NULL,
    capacidad INT UNSIGNED NULL DEFAULT 35,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_gs_ciclo
        FOREIGN KEY (id_ciclo_escolar)
        REFERENCES ciclo_escolar (id_ciclo_escolar)
        ON DELETE CASCADE,

    CONSTRAINT fk_gs_grado
        FOREIGN KEY (id_grado)
        REFERENCES grado (id_grado)
        ON DELETE CASCADE,

    CONSTRAINT fk_gs_seccion
        FOREIGN KEY (id_seccion)
        REFERENCES seccion (id_seccion)
        ON DELETE CASCADE,

    CONSTRAINT uq_grado_seccion_ciclo UNIQUE (id_ciclo_escolar, id_grado, id_seccion)
);

-- Insertar combinaciones grado-seccion para el ciclo escolar 2026
INSERT IGNORE INTO grado_seccion (id_grado_seccion, id_ciclo_escolar, id_grado, id_seccion)
VALUES
    (1, 1, 1, 1), -- 1ro Básico - Sección A
    (2, 1, 1, 2), -- 1ro Básico - Sección B
    (3, 1, 2, 2); -- 2do Básico - Sección B


-- 9.7. Alteración idempotente de la tabla usuario (Asignación de Rol)
DELIMITER //
CREATE PROCEDURE sp_alter_usuario_roles()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'usuario'
          AND COLUMN_NAME = 'id_rol'
    ) THEN
        ALTER TABLE usuario
            ADD COLUMN id_rol INT UNSIGNED NULL AFTER id_usuario,
            ADD CONSTRAINT fk_usuario_rol
                FOREIGN KEY (id_rol)
                REFERENCES rol (id_rol)
                ON DELETE SET NULL;
    END IF;
END //
DELIMITER ;

CALL sp_alter_usuario_roles();
DROP PROCEDURE IF EXISTS sp_alter_usuario_roles;

-- Asignar rol Administrador al usuario 'admin' existente
UPDATE usuario
SET id_rol = 1
WHERE usuario = 'admin' AND id_rol IS NULL;


-- 9.8. Alteración idempotente de la tabla estudiante (Relaciones con Ciclo, Grado, Sección y Grado_Seccion)
DELIMITER //
CREATE PROCEDURE sp_alter_estudiante_academico()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'estudiante'
          AND COLUMN_NAME = 'id_ciclo_escolar'
    ) THEN
        ALTER TABLE estudiante
            ADD COLUMN id_ciclo_escolar INT UNSIGNED NULL AFTER id_establecimiento,
            ADD COLUMN id_grado INT UNSIGNED NULL AFTER id_ciclo_escolar,
            ADD COLUMN id_seccion INT UNSIGNED NULL AFTER id_grado,
            ADD COLUMN id_grado_seccion INT UNSIGNED NULL AFTER id_seccion;

        ALTER TABLE estudiante
            ADD CONSTRAINT fk_estudiante_establecimiento
                FOREIGN KEY (id_establecimiento)
                REFERENCES establecimiento (id_establecimiento)
                ON DELETE CASCADE,
            ADD CONSTRAINT fk_estudiante_ciclo
                FOREIGN KEY (id_ciclo_escolar)
                REFERENCES ciclo_escolar (id_ciclo_escolar)
                ON DELETE SET NULL,
            ADD CONSTRAINT fk_estudiante_grado
                FOREIGN KEY (id_grado)
                REFERENCES grado (id_grado)
                ON DELETE SET NULL,
            ADD CONSTRAINT fk_estudiante_seccion
                FOREIGN KEY (id_seccion)
                REFERENCES seccion (id_seccion)
                ON DELETE SET NULL,
            ADD CONSTRAINT fk_estudiante_grado_seccion
                FOREIGN KEY (id_grado_seccion)
                REFERENCES grado_seccion (id_grado_seccion)
                ON DELETE SET NULL;
    END IF;
END //
DELIMITER ;

CALL sp_alter_estudiante_academico();
DROP PROCEDURE IF EXISTS sp_alter_estudiante_academico;

-- Enlazar los estudiantes de prueba existentes a la nueva estructura relacional
UPDATE estudiante
SET id_ciclo_escolar = 1, id_grado = 1, id_seccion = 1, id_grado_seccion = 1
WHERE grado = '1ro Básico' AND seccion = 'A' AND id_ciclo_escolar IS NULL;

UPDATE estudiante
SET id_ciclo_escolar = 1, id_grado = 2, id_seccion = 2, id_grado_seccion = 3
WHERE grado = '2do Básico' AND seccion = 'B' AND id_ciclo_escolar IS NULL;