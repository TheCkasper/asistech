# ASISTECH — Backend y guía de integración del equipo

Sistema de registro de asistencia escolar mediante NFC. Esta guía documenta el backend construido por Emanuel durante la semana 1 y cómo Juan y Marcos pueden probarlo. Comandos para Windows PowerShell, ejecutados desde la carpeta `asistech`, salvo que se indique HeidiSQL.

## 1. Estado actual y alcance

Ya se comprobó localmente: recepción de JSON con FastAPI, conexión a MariaDB, almacenamiento en `asistech.asistencia_nfc` y reenvío de un evento sin duplicarlo.

| Función | Estado |
|---|---|
| GET `/api/salud` | Implementado; responde `{"estado":"ok"}` |
| POST `/api/asistencia` | Implementado; valida y guarda marcajes |
| Control de duplicados | Implementado por `id_evento` único |
| Conversión de hora del marcaje a UTC | Implementada |
| Lectura NFC desde el teléfono | Responsabilidad de Juan; integración pendiente |
| Base de datos en la nube | Pendiente; actualmente local en Docker |
| Dashboard y consulta de asistencias por API | Pendientes; no existe un GET de asistencias |
| Modelo de IA | Semana 2; todavía no implementado |
| Autenticación, alumnos y asignación de tarjetas | Todavía no implementados |

La API acepta UID y establecimiento con formato válido, pero todavía no comprueba si existen o si la tarjeta pertenece a un alumno. Una lectura guardada no prueba por sí sola la presencia de ese alumno. El control de duplicados evita reintentos del mismo evento, no dos lecturas físicas que tengan UUID diferentes.

## 2. Responsabilidades y funcionamiento

| Integrante | Trabajo y entrega |
|---|---|
| Emanuel | Ejecutar y compartir la API, mantener la conexión a la BD y ayudar a resolver errores de integración |
| Juan | Leer UID NFC, generar UUID por evento, enviar JSON y comprobar la respuesta; en semana 2, conservar eventos offline y sincronizar |
| Marcos | Administrar tablas y accesos, verificar los registros recibidos y desarrollar el dashboard en semana 2 |
| Julia | Documentar requisitos, flujo real y resultados de pruebas |

El teléfono envía una petición a FastAPI. FastAPI valida los datos y los inserta en MariaDB. Juan no necesita credenciales de la BD. Marcos puede utilizar HeidiSQL, DBeaver o un cliente compatible; no necesita Docker si trabaja con la BD compartida de Emanuel.

Aunque el equipo acordó MySQL, el servidor observado actualmente es **MariaDB 11**. SQLAlchemy con `mysql+pymysql` permite trabajar con este servidor. Registrar esta elección en la documentación; migrar a MySQL real si el equipo decide que es un requisito.

## 3. Archivos del proyecto

| Archivo o carpeta | Función |
|---|---|
| `main.py` | Modelos de entrada y endpoints FastAPI |
| `database.py` | Lectura de `.env`, creación de `engine` y prueba de conexión |
| `.env` | Configuración privada de BD |
| `.gitignore` | Excluir credenciales y archivos generados |
| `.venv/` | Python y dependencias del proyecto |
| `README.md` | Esta guía |
| `requirements.txt` | Versiones para reproducir el entorno; generarlo antes de compartir |

Todos los archivos están al mismo nivel excepto el contenido de `.venv/`. Emanuel debe compartir `main.py`, `database.py`, este README y `requirements.txt`. Este README no reemplaza los archivos de código. Cada persona que ejecute el backend crea su propio `.env` y `.venv`.

## 4. Preparar el backend en otra computadora

Solo necesario para quien vaya a ejecutar una copia de la API. Juan no necesita hacerlo para usar la API compartida.

### Verificar Python

```powershell
python --version
```

El entorno de Emanuel utiliza Python 3.10.6. Si `python` no se reconoce, probar `py --version`; utilizar `py` para crear el entorno si ese es el comando disponible. Descargar Python en https://www.python.org/downloads/ si falta.

### Crear un entorno virtual

```powershell
python -m venv .venv
```

Alternativa si solo funciona el lanzador `py`:

```powershell
py -m venv .venv
```

Ejecutar solo una alternativa. No es necesario activar el entorno: los comandos siguientes utilizan directamente su ejecutable y evitan problemas de scripts de PowerShell. Si el IDE solicita intérprete, seleccionar `.venv\Scripts\python.exe`.

### Actualizar pip e instalar dependencias

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install "fastapi[standard]"
.\.venv\Scripts\python.exe -m pip install sqlalchemy pymysql python-dotenv
```

| Dependencia | Función |
|---|---|
| FastAPI y dependencias estándar | API, documentación interactiva y servidor Uvicorn |
| Pydantic | Validar UUID, fecha con zona horaria y demás campos |
| SQLAlchemy | Conexiones, SQL parametrizado y transacciones |
| PyMySQL | Controlador para MySQL/MariaDB |
| python-dotenv | Leer `.env` |

### Guardar versiones del entorno de Emanuel

```powershell
.\.venv\Scripts\python.exe -m pip freeze > requirements.txt
```

Generarlo en el entorno que ya funciona y compartirlo. Para reproducir esas versiones en otro equipo, en lugar de instalar paquetes sin versión:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Configuración privada: `.env`

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=asistech
DB_USER=TU_USUARIO
DB_PASSWORD="TU_CONTRASEÑA"
```

Usar los datos reales de la sesión de HeidiSQL. `127.0.0.1` sirve cuando Python corre en Windows y la BD está publicada en esa misma computadora. Si Marcos ejecuta Python en su equipo conectándose a la BD de Emanuel, debe poner la IP de Emanuel. Si después se ejecuta Python dentro de otro contenedor, habrá que usar el nombre del servicio de BD en la red Docker, no `127.0.0.1`.

Contenido de `.gitignore`:

```gitignore
.env
.venv/
__pycache__/
```

No compartir `.env`, credenciales o capturas de contraseñas. Para la API y para Marcos, utilizar usuarios propios con permisos limitados a `asistech`; usar root solamente para tareas administrativas iniciales.

## 5. Docker: localizar y encender la base de datos

Abrir Docker Desktop. El contenedor existente pertenece a otro proyecto; mantener sus bases y configuración intactas.

```powershell
docker ps -a
```

Lista todos los contenedores, incluidos los detenidos. Buscar la imagen MariaDB y revisar `STATUS`, `PORTS` y `NAMES`. No copiar IDs antiguos de capturas: obtener el nombre actual.

```powershell
docker ps
```

Lista solo contenedores encendidos. El servidor observado publica `3306` del equipo hacia `3306` del contenedor. Solo un contenedor puede ocupar ese mismo puerto del equipo al mismo tiempo.

Si está detenido, sustituir el marcador por su nombre real:

```powershell
docker start NOMBRE_REAL_DEL_CONTENEDOR
```

Para revisar errores de arranque:

```powershell
docker logs --tail 50 NOMBRE_REAL_DEL_CONTENEDOR
```

Alternativa a HeidiSQL para abrir una consola SQL:

```powershell
docker exec -it NOMBRE_REAL_DEL_CONTENEDOR mariadb -u root -p
```

`exec` ejecuta el cliente dentro del contenedor; `-it` permite interactuar; `-u root` elige usuario; `-p` solicita contraseña sin escribirla en el comando. Esto inicia sesión, no crea la BD. Escribir `exit;` para salir. Si se usa una imagen MySQL, su cliente puede llamarse `mysql` en lugar de `mariadb`.

HeidiSQL puede permanecer abierto mientras se ejecutan estos comandos. `No such container` significa nombre/ID incorrecto, no conflicto con HeidiSQL.

## 6. Base de datos y tabla definitiva

Ejecutar SQL en HeidiSQL: conectarse, abrir **Consulta**, pegar SQL y pulsar **F9**. La tabla elegida es `asistencia_nfc`; `marcajes` fue una propuesta anterior y la API no la utiliza.

### Instalación en una base nueva

Este bloque reproduce el esquema final, incluido `id_evento`. No ejecutarlo para modificar una tabla ya existente: `CREATE TABLE` no es una migración.

```sql
CREATE DATABASE IF NOT EXISTS asistech
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE asistech;

CREATE TABLE asistencia_nfc (
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
```

| Campo | Significado |
|---|---|
| `id_registro` | Número interno de la fila; puede tener saltos |
| `id_evento` | UUID del evento; único y conservado en cada reintento |
| `uid_nfc` | UID leído de la tarjeta; se repite en distintos marcajes |
| `id_establecimiento` | Entero positivo de la escuela |
| `fecha_hora` | Hora de captura convertida a UTC; precisión de segundos |
| `tipo_registro` | `ENTRADA` o `SALIDA`, en mayúsculas |
| `recibido_en` | Momento de recepción generado por la BD |

Los índices aceleran consultas de una tarjeta o una escuela por fechas; no evitan duplicados. La restricción UNIQUE de `id_evento` sí evita repetir un evento. Ordenar cronológicamente por `fecha_hora`; el ID representa orden de inserción, especialmente cuando hay sincronización offline.

`recibido_en` es TIMESTAMP: MariaDB lo presenta según la zona horaria de la sesión. `fecha_hora` es DATETIME con UTC por convención de la API. Para una consulta consistente, Marcos puede ejecutar `SET time_zone = '+00:00';` al iniciar su sesión. Para mostrar hora de Guatemala, convertir UTC a UTC−06:00.

### Migración que ya se realizó en el equipo de Emanuel

Solo para una tabla antigua que aún NO tenga `id_evento`. No repetir en la tabla actual.

```sql
ALTER TABLE asistech.asistencia_nfc
ADD COLUMN id_evento CHAR(36) NULL AFTER id_registro;

UPDATE asistech.asistencia_nfc
SET id_evento = UUID()
WHERE id_evento IS NULL;

ALTER TABLE asistech.asistencia_nfc
MODIFY COLUMN id_evento CHAR(36) NOT NULL,
ADD CONSTRAINT uq_asistencia_id_evento UNIQUE (id_evento);
```

Se añadió la columna, se asignó UUID al registro anterior y se hizo obligatoria y única sin borrar datos. Los nuevos UUID los genera Juan; la API no los genera automáticamente.

### Verificación del esquema

```sql
SHOW DATABASES LIKE 'asistech';
USE asistech;
SHOW TABLES;
SHOW CREATE TABLE asistencia_nfc;
SHOW INDEX FROM asistencia_nfc;
SELECT COUNT(*) AS total_registros FROM asistencia_nfc;
```

## 7. Comprobar la conexión y levantar la API

En una terminal del proyecto:

```powershell
.\.venv\Scripts\python.exe database.py
```

Ejecuta la comprobación `SELECT 1`. Resultado esperado: `Conexión exitosa con la base de datos ASISTECH.` Esto comprueba conexión, no estructura de tablas.

### Solo en la computadora de Emanuel

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

`main:app` identifica el archivo `main.py` y el objeto `app`. `--reload` recarga cambios durante desarrollo. Mantener la terminal abierta; **Ctrl + C** detiene el servidor.

| Dirección | Función |
|---|---|
| http://127.0.0.1:8000/api/salud | Comprobar que la API responde |
| http://127.0.0.1:8000/docs | Swagger UI: consultar y probar endpoints |
| http://127.0.0.1:8000/redoc | Documentación alternativa |
| http://127.0.0.1:8000/openapi.json | Contrato técnico para integración |

GET consulta; POST envía un cuerpo JSON. Abrir `/api/asistencia` directamente en la barra del navegador realiza GET y dará 405 porque esa ruta solo admite POST.

### Compartir la API en la misma red

Detener la ejecución anterior y usar:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

`0.0.0.0` hace que el servidor escuche en las interfaces del equipo; no es la dirección que deben escribir los compañeros.

En otra terminal:

```powershell
ipconfig
```

Buscar IPv4 del adaptador activo. Si fuera `192.168.1.25`, Juan y Marcos usarían `http://192.168.1.25:8000/docs`. Sustituir siempre por la IP real. Desde sus dispositivos, `localhost` o `127.0.0.1` apunta a ellos mismos, no a Emanuel. Las IP pueden cambiar al reconectar el equipo.

Permitir Python o TCP 8000 en el firewall de Windows para la red privada de pruebas. Si el Wi-Fi tiene aislamiento de clientes o es una red de invitados, puede bloquear conexiones entre dispositivos. No abrir puertos del router: esta etapa es una prueba en la LAN. La API actual no tiene autenticación y no está preparada para exponerla públicamente.

Para probar desde otra computadora Windows:

```powershell
Test-NetConnection 192.168.1.25 -Port 8000
Invoke-RestMethod -Uri "http://192.168.1.25:8000/api/salud" -Method Get
```

Si están en casas distintas, coordinar VPN o despliegue en servidor. La IP privada no permite acceso directo por internet. El cronograma incluye BD en la nube: esa parte todavía requiere despliegue y pruebas.

## 8. Contrato de POST para Juan

**Método:** POST. **Ruta:** `/api/asistencia`. **Cabecera:** `Content-Type: application/json`. **Autenticación:** no implementada en la versión local.

```json
{
  "id_evento": "550e8400-e29b-41d4-a716-446655440000",
  "uid_nfc": "04A1B2C3D4",
  "id_establecimiento": 1,
  "fecha_hora": "2026-10-06T07:00:00-06:00",
  "tipo_registro": "ENTRADA"
}
```

| Campo | Regla actual |
|---|---|
| `id_evento` | UUID válido enviado como texto; nuevo para cada evento |
| `uid_nfc` | Texto de 1 a 100 caracteres, sin espacios |
| `id_establecimiento` | Entero mayor que cero |
| `fecha_hora` | Fecha ISO 8601 con zona horaria obligatoria, `-06:00` o `Z` |
| `tipo_registro` | Exactamente `ENTRADA` o `SALIDA` |

Juan debe enviar un UID consistente, por ejemplo hexadecimal en mayúsculas sin separadores. La API actual no normaliza mayúsculas o separadores; acordar el formato. Usar `UUID.randomUUID().toString()` en Android para generar el ID al capturar, no en cada intento de envío.

Enviar la hora real de lectura. Si se guarda offline, conservar UUID, UID, hora, escuela y tipo originales. No reemplazar la hora por la de sincronización. La API convierte a UTC y elimina microsegundos: el ejemplo se guarda como `2026-10-06 13:00:00`.

### Respuestas de la versión actual

Nuevo evento, **HTTP 200**:

```json
{
  "estado": "guardado",
  "id_registro": 2,
  "mensaje": "Marcaje guardado correctamente."
}
```

Reenvío con el mismo UUID y datos, **HTTP 200**:

```json
{
  "estado": "ya_registrado",
  "id_registro": 2,
  "mensaje": "Este evento ya estaba guardado."
}
```

El ID es ilustrativo. La versión anterior respondía 201 al insertar; la versión final con control de duplicados responde **200** en ambos casos. Juan debe tomar ambos estados como confirmación de éxito y retirar ese evento de la cola offline.

| Código | Significado | Acción de Juan |
|---|---|---|
| 200 | Guardado o ya registrado | Confirmar evento; no reenviar indefinidamente |
| 409 | Mismo UUID con otros datos | Investigar conflicto; no sobrescribir ni cambiar UUID automáticamente |
| 422 | Entrada inválida o campo faltante | Corregir datos; consultar `detail` |
| 503 | Error al guardar en BD | Conservar evento y reintentar con el mismo UUID y datos |
| Sin respuesta / timeout | Resultado desconocido | Conservar y reintentar el mismo evento; podría haberse guardado |
| 404 / 405 | Ruta o método incorrectos | Revisar URL y POST |

Ejemplo de 409: `{"detail":"El id_evento ya existe con otros datos."}`. Ejemplo de 503: `{"detail":"No se pudo guardar el marcaje."}`. El cuerpo 422 contiene la lista de errores de validación.

### Android: puntos de integración

1. Teléfono con NFC y tarjeta compatible; comprobar lectura física.
2. Añadir permiso `android.permission.INTERNET` y los requisitos NFC de la app.
3. Configurar URL base con la IP de Emanuel, puerto 8000.
4. Enviar JSON con el contrato anterior mediante el cliente HTTP de la app.
5. Leer código HTTP y JSON de respuesta, además de mostrar mensajes al usuario.
6. Evitar generar múltiples eventos por una tarjeta mantenida sobre el lector; el control por UUID no reemplaza ese control de lectura.

Para probar HTTP local en Android, revisar la política de tráfico sin cifrar. Si aparece `CLEARTEXT communication not permitted`, Juan debe configurar una excepción en la variante de depuración; por ejemplo, `android:usesCleartextTraffic="true"` en `<application>` del manifest de debug si no hay una política de red que lo reemplace. No llevar esa excepción general al despliegue final; allí utilizar HTTPS. En un emulador Android estándar ejecutado en la computadora de Emanuel, `10.0.2.2` permite acceder al host; en un teléfono real se usa la IP LAN de Emanuel. Si el emulador corre en la computadora de Juan, `10.0.2.2` apunta al equipo de Juan, no al de Emanuel.

## 9. Pruebas desde Swagger y PowerShell

### Swagger

1. Abrir `/docs` y actualizar después de cambios.
2. Expandir POST `/api/asistencia`.
3. Pulsar **Try it out**, pegar el JSON y pulsar **Execute**.
4. Revisar **Server response**, no solo el ejemplo de documentación.
5. Ejecutar de nuevo con el mismo cuerpo: debe devolver `ya_registrado` con el mismo ID.

### PowerShell: evento nuevo y reenvío

Cambiar la URL base si se prueba desde otro dispositivo.

```powershell
$asisBaseUrl = "http://127.0.0.1:8000"
$asisEventoId = [guid]::NewGuid().ToString()
$asisCuerpo = @{
    id_evento = $asisEventoId
    uid_nfc = "04A1B2C3D4"
    id_establecimiento = 1
    fecha_hora = "2026-10-06T07:00:00-06:00"
    tipo_registro = "ENTRADA"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$asisBaseUrl/api/asistencia" -Method Post -ContentType "application/json" -Body $asisCuerpo
Invoke-RestMethod -Uri "$asisBaseUrl/api/asistencia" -Method Post -ContentType "application/json" -Body $asisCuerpo
```

La variable conserva el mismo cuerpo para ambos envíos. Generar un nuevo UUID para el siguiente evento independiente. No reutilizar el UUID de ejemplo para todas las tarjetas.

### Matriz de pruebas de integración

| Prueba | Resultado esperado |
|---|---|
| Evento nuevo válido | 200, `guardado`, una fila nueva |
| Mismo UUID y datos | 200, `ya_registrado`, ninguna fila adicional |
| Mismo UUID y UID distinto | 409, ninguna modificación a la fila |
| Falta `id_evento` | 422, sin inserción |
| Fecha sin `-06:00` o `Z` | 422 |
| `tipo_registro` = `OTRO` | 422 |
| `id_establecimiento` = 0 | 422 |
| UID vacío o con espacios | 422 |
| Hora 07:00 con `-06:00` | BD guarda 13:00 UTC |
| Lectura NFC real | Juan recibe confirmación y Marcos encuentra la misma fila |

No detener el contenedor compartido para simular fallos sin coordinar, porque contiene otros proyectos. Hacer pruebas de caída en un entorno aislado si se necesitan.

## 10. Marcos: acceso y verificación de datos

Para trabajo local en el equipo de Emanuel, utilizar HeidiSQL con host `127.0.0.1` y puerto publicado, actualmente 3306. Para conectarse desde el equipo de Marcos en la LAN:

| Dato | Valor |
|---|---|
| Host | IPv4 de Emanuel, por ejemplo `192.168.1.25` |
| Puerto | Puerto publicado por Docker, actualmente `3306` |
| Usuario | Usuario propio creado para Marcos |
| Contraseña | Entregada por canal privado |
| Base de datos | `asistech` |

Emanuel debe configurar permisos del usuario y firewall privado para ese acceso. Publicar el puerto de Docker no crea el usuario ni concede permisos. No utilizar root compartido. MariaDB puede producir avisos o incompatibilidades con algunas versiones de MySQL Workbench; HeidiSQL o DBeaver son alternativas.

Comprobar conectividad desde PowerShell de Marcos:

```powershell
Test-NetConnection 192.168.1.25 -Port 3306
```

Solo abrir ese acceso para administración en la red de pruebas. El teléfono no debe acceder a 3306.

Consultas de verificación en HeidiSQL:

```sql
SET time_zone = '+00:00';

SELECT *
FROM asistech.asistencia_nfc
ORDER BY id_registro DESC
LIMIT 10;

SELECT COUNT(*) AS cantidad
FROM asistech.asistencia_nfc
WHERE id_evento = '550e8400-e29b-41d4-a716-446655440000';
```

La segunda consulta debe devolver 1 para ese evento; sustituir UUID si se usó otro. Para visualizar Guatemala:

```sql
SELECT id_registro, id_evento, uid_nfc, id_establecimiento,
       fecha_hora AS hora_utc,
       DATE_SUB(fecha_hora, INTERVAL 6 HOUR) AS hora_guatemala,
       tipo_registro, recibido_en
FROM asistech.asistencia_nfc
ORDER BY fecha_hora DESC, id_registro DESC
LIMIT 20;
```

### Dashboard: dependencia pendiente

Actualmente GET `/api/salud` solo indica que FastAPI responde; no comprueba la BD ni entrega asistencias. **No existe GET `/api/asistencia` ni un endpoint de alertas.** Marcos debe coordinar con Emanuel un endpoint de consulta antes de conectar un dashboard HTML/JS. No poner credenciales de MySQL en JavaScript del navegador. Una alternativa para un prototipo Streamlit es consultar la BD desde el proceso servidor de Streamlit con un usuario de lectura, sin exponer credenciales al navegador.

Si el frontend consume la API desde otro origen, habrá que habilitar CORS. Esto no forma parte del `main.py` actual. Ejemplo opcional para agregar después de crear `app`, sustituyendo los orígenes por los reales:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://192.168.1.30:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
```

Son ejemplos de direcciones del frontend, no del backend. CORS es una política del navegador; no se resuelve cambiando los permisos de MySQL y no autentica usuarios. Una app Android nativa no necesita CORS.

## 11. Errores frecuentes

| Mensaje o síntoma | Qué revisar |
|---|---|
| `python` no reconocido | Instalación de Python; probar `py` |
| `No module named ...` | Instalar en `.venv` y usar su ejecutable |
| `Could not import module main` | Terminal en la carpeta correcta y `main.py` guardado |
| `KeyError: DB_USER` u otra variable | Nombre, ubicación y campos del archivo `.env` |
| Puerto 8000 ocupado | Detener la API anterior con Ctrl+C; no abrir dos servidores en el mismo puerto |
| `No such container` | Obtener nombre actual con `docker ps -a` |
| MariaDB no arranca / 3306 ocupado | Otro contenedor o servidor está usando el puerto |
| `Access denied` | Usuario, contraseña y permisos para el host de conexión |
| `Can't connect` | Docker, servidor, host, puerto y firewall |
| GET salud funciona pero POST da 503 | Revisar conexión, tabla, columnas y permisos INSERT/SELECT; salud no comprueba la BD |
| `Duplicate column` al migrar | `id_evento` ya existe; no repetir la migración |
| 422 al enviar el ejemplo antiguo | Ahora son obligatorios UUID, establecimiento y tipo además de UID/hora |
| Teléfono no abre `/docs` | IP real, misma red, firewall, aislamiento Wi-Fi y escucha en 0.0.0.0 |
| App Android bloquea HTTP | Configuración de tráfico sin cifrar para depuración |
| Navegador bloquea frontend por CORS | Configurar orígenes exactos en FastAPI |
| Hora parece adelantada 6 horas | `fecha_hora` está guardada en UTC; convertir al mostrar |

El script `database.py` y la API ocultan detalles SQL en sus mensajes. Si aparece un error genérico y las revisiones no lo resuelven, Emanuel debe revisar el diagnóstico local sin publicar credenciales ni detalles internos en las respuestas HTTP.

## 12. Cierre de semana 1 y pendientes

Cronograma: semana 1 del 6 al 9 de octubre de 2026; primera prueba física el sábado 10. Emanuel debe programar la API y POST; Marcos preparar la BD en servidor de paga; Juan leer NFC y enviar a la API. La entrega local está avanzada, pero la integración física y la nube todavía deben comprobarse.

Antes de la prueba:

- [ ] Emanuel comparte código, README, requirements y URL real.
- [ ] MariaDB y la API están encendidos.
- [ ] Juan abre salud/docs desde el teléfono y confirma conectividad.
- [ ] Juan captura una tarjeta real y envía un UUID nuevo con hora real.
- [ ] La API responde `guardado`.
- [ ] Marcos verifica UUID, UID, escuela, tipo y hora en la BD.
- [ ] Juan reenvía el mismo evento; responde `ya_registrado` sin fila adicional.
- [ ] Se registra evidencia sin credenciales y se coordina el despliegue en nube.

La semana 2 incorpora IA, sincronización offline y dashboard; la semana 3 integración de IA con producción y pruebas finales. No afirmar que ya existen modelos predictivos, usuarios autenticados, control de alumnos, consulta web de asistencia o despliegue público.

## 13. Referencias oficiales

- Python en Windows: https://docs.python.org/3/using/windows.html
- Entornos virtuales: https://docs.python.org/3/library/venv.html
- FastAPI: https://fastapi.tiangolo.com/
- SQLAlchemy y MySQL/MariaDB: https://docs.sqlalchemy.org/en/20/dialects/mysql.html
- Configuración de conexiones SQLAlchemy: https://docs.sqlalchemy.org/en/20/core/engines.html
- CORS: https://fastapi.tiangolo.com/tutorial/cors/
- NFC Android: https://developer.android.com/develop/connectivity/nfc
- Seguridad de red Android: https://developer.android.com/privacy-and-security/security-config

Esta guía describe el código construido durante la sesión. Los comandos de despliegue en LAN, las excepciones Android y CORS son instrucciones de integración pendientes de aplicar y verificar en los dispositivos del equipo.
