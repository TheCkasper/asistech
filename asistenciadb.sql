-- =====================================================================
-- ASISTECH - Base de datos AsistenciaDB (MySQL 8.0.16 o superior)
-- Parte de Marcos: tablas, vistas y accesos.
--
-- Cómo ejecutarlo: HeidiSQL o DBeaver > Consulta > pegar todo > F9 (Alt+X en DBeaver).
-- Se puede ejecutar varias veces sin duplicar nada.
--
-- Contenido:
--   0. Base de datos AsistenciaDB
--   1. asistencia_nfc  -> tabla de Emanuel, igual a la del README (solo se crea si no existe)
--   2. estudiante      -> a quién pertenece cada tarjeta
--   3. alerta_ia       -> alertas del modelo de IA (semana 2-3)
--   4. vw_lecturas_hoy / vw_alertas_abiertas
--
-- IMPORTANTE - mayúsculas y minúsculas:
-- MySQL en Linux (incluye contenedores Docker, aunque corran en Windows) distingue
-- mayúsculas en nombres de bases y tablas. Escribe siempre exactamente "AsistenciaDB":
-- en este script, en DB_NAME del .env y en cualquier consulta con prefijo
-- (por ejemplo AsistenciaDB.asistencia_nfc).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Base de datos
-- ---------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS AsistenciaDB
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE AsistenciaDB;

-- ---------------------------------------------------------------------
-- 1. Tabla de marcajes NFC (esquema definitivo del README, sección 7)
--    Si la tabla ya existe, esta sentencia no la modifica.
--    fecha_hora se guarda en UTC por convención de la API.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asistencia_nfc (
    id_registro        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_evento          CHAR(36)     NOT NULL,
    uid_nfc            VARCHAR(100) NOT NULL,
    id_establecimiento INT UNSIGNED NOT NULL,
    fecha_hora         DATETIME     NOT NULL COMMENT 'Hora del marcaje en UTC',
    tipo_registro      ENUM('ENTRADA', 'SALIDA') NOT NULL,
    recibido_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_asistencia_id_evento UNIQUE (id_evento),
    INDEX idx_uid_fecha (uid_nfc, fecha_hora),
    INDEX idx_establecimiento_fecha (id_establecimiento, fecha_hora)
);

-- ---------------------------------------------------------------------
-- 2. Estudiantes y asignación de tarjetas
--    uid_nfc es único: una tarjeta pertenece a un solo estudiante.
--    Usa el formato de UID que acuerden Juan y Emanuel (hexadecimal en
--    mayúsculas, sin separadores). Con utf8mb4_unicode_ci la comparación ya
--    ignora mayúsculas, pero NO ignora separadores como ":" o espacios.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estudiante (
    id_estudiante      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    uid_nfc            VARCHAR(100) NOT NULL,
    nombre             VARCHAR(120) NOT NULL,
    grado              VARCHAR(40)  NULL,
    seccion            VARCHAR(10)  NULL,
    id_establecimiento INT UNSIGNED NOT NULL,
    activo             TINYINT(1)   NOT NULL DEFAULT 1,
    creado_en          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_estudiante_uid UNIQUE (uid_nfc),
    INDEX idx_estudiante_estab (id_establecimiento, activo)
);

-- ---------------------------------------------------------------------
-- 3. Alertas del modelo de IA (las escribe el proceso de Emanuel)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerta_ia (
    id_alerta     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_estudiante INT UNSIGNED NOT NULL,
    tipo          VARCHAR(40)  NOT NULL,   -- ausencias_recurrentes | tardanzas_crecientes | lectura_duplicada | otro
    severidad     ENUM('alta', 'media', 'baja') NOT NULL,
    puntaje       DECIMAL(4,3) NOT NULL,   -- 0.000 a 1.000
    descripcion   TEXT         NOT NULL,
    creada_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revisada      TINYINT(1)   NOT NULL DEFAULT 0,
    revisada_en   TIMESTAMP    NULL DEFAULT NULL,
    CONSTRAINT fk_alerta_estudiante FOREIGN KEY (id_estudiante)
        REFERENCES estudiante (id_estudiante) ON DELETE CASCADE,
    CONSTRAINT ck_alerta_puntaje CHECK (puntaje BETWEEN 0 AND 1),
    INDEX idx_alerta_abiertas (revisada, creada_en)
);

-- ---------------------------------------------------------------------
-- 4. Vistas
--    Guatemala es UTC-6 todo el año. "Hoy" empieza a las 06:00 UTC (medianoche
--    en Guatemala). UTC_TIMESTAMP() no depende de la zona horaria de la sesión.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_lecturas_hoy AS
SELECT a.id_registro,
       a.id_evento,
       a.uid_nfc,
       a.id_establecimiento,
       a.tipo_registro,
       a.fecha_hora,                                          -- UTC, tal como la guarda la API
       DATE_SUB(a.fecha_hora, INTERVAL 6 HOUR) AS hora_guatemala,
       COALESCE(e.nombre, 'UID sin registrar')  AS nombre,
       CONCAT_WS(' ', e.grado, e.seccion)       AS grado
FROM asistencia_nfc a
LEFT JOIN estudiante e ON e.uid_nfc = a.uid_nfc
WHERE a.fecha_hora >= DATE_ADD(DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 HOUR)), INTERVAL 6 HOUR)
  AND a.fecha_hora <  DATE_ADD(DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 6 HOUR)), INTERVAL 30 HOUR);

CREATE OR REPLACE VIEW vw_alertas_abiertas AS
SELECT al.id_alerta,
       e.id_establecimiento,
       e.nombre,
       CONCAT_WS(' ', e.grado, e.seccion) AS grado,
       al.tipo,
       al.severidad,
       al.puntaje,
       al.descripcion,
       al.creada_en
FROM alerta_ia al
JOIN estudiante e ON e.id_estudiante = al.id_estudiante
WHERE al.revisada = 0;

-- ---------------------------------------------------------------------
-- 5. Estudiantes de prueba para la primera verificación
--    El primero usa el UID del ejemplo del README (04A1B2C3D4).
--    Bórralos antes de cargar a los estudiantes reales (sección 8).
-- ---------------------------------------------------------------------
INSERT IGNORE INTO estudiante (uid_nfc, nombre, grado, seccion, id_establecimiento) VALUES
    ('04A1B2C3D4', 'Estudiante de prueba 1', '1ro Básico', 'A', 1),
    ('04A1B2C3D5', 'Estudiante de prueba 2', '1ro Básico', 'A', 1),
    ('04A1B2C3D6', 'Estudiante de prueba 3', '2do Básico', 'B', 1);

-- ---------------------------------------------------------------------
-- 6. Verificación (ejecuta estas líneas una por una)
-- ---------------------------------------------------------------------
-- SHOW TABLES;                               -- asistencia_nfc, estudiante, alerta_ia y las 2 vistas
-- SELECT * FROM estudiante;                  -- los 3 estudiantes de prueba
-- SELECT * FROM vw_lecturas_hoy;             -- lecturas del día con nombre y hora_guatemala
-- SELECT COUNT(*) FROM asistencia_nfc;       -- si ya había datos, el conteo no debe cambiar

-- ---------------------------------------------------------------------
-- 7. Accesos (los ejecuta quien administre MySQL; el README pide NO usar root compartido)
--    Cambia las claves y limita el host a la red de pruebas en lugar de '%'.
--    Entrega cada clave por canal privado, nunca por Git.
-- ---------------------------------------------------------------------
-- Usuario de solo lectura para ti (HeidiSQL) o para un prototipo en Streamlit:
-- CREATE USER IF NOT EXISTS 'marcos'@'192.168.1.%' IDENTIFIED BY 'CAMBIAR_CLAVE';
-- GRANT SELECT ON AsistenciaDB.* TO 'marcos'@'192.168.1.%';
--
-- Permisos que necesita el usuario de la API de Emanuel para el dashboard
-- (SELECT sobre lo que consulta y UPDATE solo de las dos columnas de alerta_ia):
-- GRANT SELECT ON AsistenciaDB.estudiante TO 'USUARIO_API'@'HOST_API';
-- GRANT SELECT ON AsistenciaDB.vw_lecturas_hoy TO 'USUARIO_API'@'HOST_API';
-- GRANT SELECT ON AsistenciaDB.vw_alertas_abiertas TO 'USUARIO_API'@'HOST_API';
-- GRANT SELECT ON AsistenciaDB.alerta_ia TO 'USUARIO_API'@'HOST_API';
-- GRANT UPDATE (revisada, revisada_en) ON AsistenciaDB.alerta_ia TO 'USUARIO_API'@'HOST_API';
-- (El usuario de la API ya debe tener INSERT y SELECT sobre asistencia_nfc para el POST.)

-- ---------------------------------------------------------------------
-- 8. Limpieza de datos de prueba (cuando ya cargues estudiantes reales)
-- ---------------------------------------------------------------------
-- DELETE FROM estudiante WHERE nombre LIKE 'Estudiante de prueba%';
