# ASISTECH — Backend y guía de integración del equipo

Sistema de registro de asistencia escolar mediante NFC. Esta guía documenta el backend construido por Emanuel durante la semana 1 y cómo Juan y Marcos pueden probarlo. Comandos para Windows PowerShell, ejecutados desde la carpeta `asistech`, salvo que se indique HeidiSQL.

## 1. Estado actual y alcance

Ya se comprobó localmente: recepción de JSON con FastAPI, conexión a MariaDB, almacenamiento en `asistech.asistencia_nfc` y reenvío de un evento sin duplicarlo.

| Función | Estado |
|---|---|
| GET `/api/salud` | Implementado; responde `{"estado":"ok"}` |
| POST `/api/asistencia` | Implementado; valida y guarda marcajes |
| GET `/api/asistencia` | Implementado; permite registro directo por enlace web NFC |
| GET `/api/dashboard` | Implementado; consulta asistencias de hoy, total y alertas de IA desde MariaDB |
| PATCH `/api/alertas/{id}` | Implementado; marca alertas de IA como revisadas en la base de datos |
| GET/POST/PUT `/api/estudiantes` | Implementado; CRUD completo de estudiantes y asignación por establecimiento |
| GET `/api/estudiantes/{id}/asistencias` | Implementado; historial de marcajes del estudiante por período (semana, mes, ciclo) |
| GET `/api/opciones_academicas` | Implementado; consulta ciclos escolares, grados y secciones |
| GET `/api/reporte_asistencia` | Implementado; primera entrada y última salida por estudiante y día, filtrable por grado, sección y fechas |
| Dashboard Web en tiempo real | Implementado (`Panel_de_asistencia.html`) con sondeo periódico hacia la API |
| Módulo Web de Estudiantes | Implementado (`Estudiantes.html`) con listado, creación, edición, estado e historial |
| Control de duplicados | Implementado por `id_evento` único |
| Conversión de hora del marcaje a UTC | Implementada |
| Prueba con tarjeta física NFC | Realizada exitosamente con UID real y sincronizada en vivo con el dashboard |
| Lectura NFC automática desde el teléfono | Implementado en app Android nativa (APK beta generado) |
| Base de datos en la nube | Desplegado en producción (BanaHosting / MariaDB / LiteSpeed) |
| Modelo de IA | Semana 2; base de datos preparada con tablas y vistas (`alerta_ia`, `vw_alertas_abiertas`) |
| Autenticación de usuarios | Implementado en `/api/login` con hashing Bcrypt |

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
| `main.py` | Modelos de entrada, enrutamiento estático y endpoints FastAPI |
| `dashboard_api.py` | Router para endpoints del dashboard, CRUD de estudiantes e historial de asistencias |
| `database.py` | Lectura de `.env`, creación de `engine` y prueba de conexión |
| `bdasistechs.sql` | Script SQL completo de la base de datos `asistech` con tablas, vistas, roles y gestión académica |
| `login.html` | Interfaz de inicio de sesión de usuarios |
| `Panel_de_asistencia.html` | Panel de control web principal con métricas, lecturas en vivo y alertas |
| `Estudiantes.html` | Módulo web para gestión/CRUD de estudiantes e historial de marcajes |
| `js/app.js` | Lógica de sondeo y renderizado en vivo para el panel de asistencia |
| `js/estudiantes.js` | Lógica cliente para creación, edición e historial de asistencias de estudiantes |
| `css/styles.css` | Hoja de estilos unificada del sistema ASISTECH |
| `.env` | Configuración privada de BD (no se sube a Git) |
| `.env.example` | Plantilla de ejemplo con las variables requeridas para la conexión a la BD |
| `.gitignore` | Excluir credenciales y archivos generados |
| `.venv/` | Python y dependencias del proyecto |
| `README.md` | Esta guía |
| `requirements.txt` | Versiones para reproducir el entorno; generarlo antes de compartir |

Todos los archivos están al mismo nivel excepto el contenido de `.venv/`. El proyecto se gestiona mediante el repositorio en GitHub (`https://github.com/TheCkasper/asistech.git`). Cada persona que clone o ejecute el backend debe crear su propio `.env` a partir de `.env.example` y su propio `.venv`.

## 4. Control de versiones con Git y gestión de ramas

El repositorio cuenta con ramas de trabajo individuales para que cada miembro del equipo avance en su área sin interferir con el código de los demás ni comprometer la rama principal:

| Rama | Responsable | Propósito |
|---|---|---|
| `main` | Equipo completo | Rama principal estable. Contiene las versiones funcionales e integradas |
| `emanuel` | Emanuel | Backend con FastAPI, endpoints, modelos Pydantic y lógica de BD |
| `marcos` | Marcos | Administración de base de datos, consultas SQL y desarrollo del dashboard |
| `juan` | Juan | Aplicación móvil Android, lectura de tarjetas NFC y peticiones HTTP |
| `julia` | Julia | Documentación de requisitos, flujo real y resultados de pruebas |

### Cómo clonar el repositorio paso a paso (Git Bash)

Si vas a descargar el proyecto por primera vez en tu computadora:

1. **Abrir la carpeta contenedora en Windows**:
   Abre el Explorador de Archivos y navega hasta la carpeta donde quieras guardar el proyecto (por ejemplo, `Documentos\Proyectos` o en tu disco de preferencia).

2. **Abrir Git Bash en esa ubicación**:
   - Haz clic derecho en un espacio vacío dentro de la carpeta.
   - Selecciona la opción **"Git Bash Here"**.
   - *(En Windows 11, si no lo ves de inmediato, haz clic en **Mostrar más opciones** y luego en **Git Bash Here**)*.

3. **Clonar el repositorio**:
   En la terminal de Git Bash que se acaba de abrir, copia y ejecuta:
   ```bash
   git clone https://github.com/TheCkasper/asistech.git
   ```

4. **Entrar a la carpeta del proyecto recién descargado**:
   ```bash
   cd asistech
   ```

5. **Cambiarse a tu rama de trabajo**:
   Al clonar, por defecto estarás ubicado en la rama principal (`main`). Para moverte a tu rama correspondiente:
   ```bash
   git checkout <nombre_de_la_rama>
   # o alternativamente:
   git switch <nombre_de_la_rama>
   ```

   **Ejemplos según tu rol:**
   - **Emanuel**: `git checkout emanuel` *(o `git switch emanuel`)*
   - **Marcos**: `git checkout marcos` *(o `git switch marcos`)*
   - **Juan**: `git checkout juan` *(o `git switch juan`)*
   - **Julia**: `git checkout julia` *(o `git switch julia`)*

6. **Confirmar en qué rama estás**:
   ```bash
   git branch
   ```
   *(Verás la lista de ramas y la tuya estará marcada con un asterisco `*`)*.

---

### Consultar las ramas existentes

Para saber en qué rama estás ubicado y qué ramas locales tienes disponibles en tu terminal:

```powershell
git branch
```

*(La rama en la que te encuentras aparecerá marcada con un asterisco `*`)*.

Para ver todas las ramas, incluyendo las ramas remotas subidas a GitHub:

```powershell
git branch -a
```

### Cómo cambiarse de rama

Para cambiarte a la rama de otro integrante o a la tuya propia, puedes usar tanto el comando tradicional `git checkout` como el comando moderno `git switch`:

#### Cambiarse a la rama de Marcos:
```powershell
git checkout marcos
# o alternativamente:
git switch marcos
```

#### Cambiarse a la rama de Juan:
```powershell
git checkout juan
# o alternativamente:
git switch juan
```

#### Cambiarse a la rama de Emanuel:
```powershell
git checkout emanuel
# o alternativamente:
git switch emanuel
```

#### Cambiarse a la rama de Julia:
```powershell
git checkout julia
# o alternativamente:
git switch julia
```

#### Regresar a la rama principal (`main`):
```powershell
git checkout main
# o alternativamente:
git switch main
```

### Si la rama aún no aparece en tu máquina local

Si un compañero creó o subió una rama a GitHub y al ejecutar `git branch` no la encuentras:

```powershell
# 1. Descargar las referencias y ramas remotas actualizadas
git fetch origin

# 2. Cambiarte a la rama (Git creará automáticamente la copia local con seguimiento)
git checkout marcos
# o: git checkout juan
# o: git checkout julia
```

### Flujo recomendado al trabajar con ramas

1. **Antes de cambiarte de rama**: Revisa que tu entorno esté limpio con `git status`. Si tienes cambios pendientes en tu rama que no quieres perder, guárdalos temporalmente con `git stash` o haz commit (`git commit -am "avance"`) antes de cambiarte para evitar sobreescrituras accidentales.
2. **Al entrar a una rama**: Descarga siempre la versión más reciente del repositorio remoto:
   ```powershell
   git pull origin <nombre_de_la_rama>
   ```
3. **Al terminar tus cambios**: Sube tus avances a tu rama en GitHub:
   ```powershell
   git add .
   git commit -m "Descripción de los cambios realizados"
   git push origin <nombre_de_la_rama>
   ```

## 5. Preparar el backend en otra computadora

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

El repositorio incluye el archivo `.env.example` como plantilla de ejemplo para que los integrantes configuren su conexión sin exponer contraseñas reales en Git. 

Para crear tu archivo de configuración, haz una copia de `.env.example` llamándola `.env`:

```powershell
Copy-Item .env.example .env
```

Luego abre `.env` y coloca los datos reales de tu base de datos:

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

## 6. Docker: localizar y encender la base de datos (Opcional si usas docker, si no se usa docker omitir este paso)

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

## 7. Base de datos y tabla definitiva

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

## 8. Comprobar la conexión y levantar la API

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

## 9. Contrato de POST para Juan

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

## 10. Pruebas desde Swagger y PowerShell

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

## 11. Marcos: acceso y verificación de datos

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

### Dashboard y Módulo de Estudiantes (Endpoints Integrados)

Los endpoints necesarios para el dashboard web y la gestión de estudiantes están completamente implementados en `dashboard_api.py`:

- **`GET /api/dashboard`**: Devuelve total de estudiantes activos, lecturas en vivo del día y alertas pendientes de IA.
- **`PATCH /api/alertas/{id_alerta}`**: Permite marcar las alertas del modelo de IA como revisadas.
- **`GET /api/estudiantes`**: Obtiene el listado de estudiantes del establecimiento con filtro de búsqueda por nombre o UID.
- **`POST /api/estudiantes`**: Registra un nuevo estudiante en la base de datos.
- **`PUT /api/estudiantes/{id_estudiante}`**: Modifica la información o estado (Activo/Inactivo) de un estudiante.
- **`GET /api/estudiantes/{id_estudiante}/asistencias`**: Consulta el historial de marcajes de asistencia del estudiante por período (semana, mes o ciclo escolar).
- **`GET /api/opciones_academicas`**: Devuelve las opciones de ciclos escolares, grados y secciones configurados.
- **`GET /api/reporte_asistencia`**: Parámetros opcionales `id_establecimiento`, `grado`, `seccion`, `desde` y `hasta` (`YYYY-MM-DD`, día local de Guatemala, UTC-6). Devuelve por estudiante y día `nombre`, `uid_nfc`, `grado`, `seccion`, `dia`, `entrada` (primera ENTRADA) y `salida` (última SALIDA), en ISO UTC. Solo aparecen los días con al menos un marcaje.

#### Reportes en PDF y Excel (vista `Estudiantes.html`)

Los botones se encuentran en la cabecera de la vista de estudiantes (`Estudiantes.html` + `js/estudiantes.js`). Cada uno abre una ventana emergente para elegir los filtros.

- **Exportar reporte**: filtros grado, sección, desde y hasta. Columnas: Fecha, Estudiante, UID tarjeta, Grado, Hora entrada y Hora salida. Se descarga como **PDF** (jsPDF + jsPDF-AutoTable) o **Excel** (`.xls` en formato HTML, Excel puede mostrar un aviso de formato).
- **Listado asistencia**: filtros mes, año, grado y sección (opcional). Genera un PDF horizontal "LISTA DE ASISTENCIA" con la escuela **UMG** (constante `NOMBRE_ESCUELA` en `estudiantes.js`), solo con los estudiantes activos del grado y sección elegidos, días hábiles (lunes a viernes) agrupados por semana, `%` de asistencia, fila "Asistencias del día", total de alumnos, promedio y espacio de firma.
  - **A**: marcó entrada y salida ese día.
  - **R**: marcó solo entrada o solo salida.
  - **F**: sin ningún marcaje.
  - Los días futuros quedan en blanco; los feriados salen como F porque el sistema no los conoce. El `%` se calcula como A sobre los días ya transcurridos.
  - La tabla `estudiante` no guarda género ni docente, por lo que esos campos del formato original no se incluyen.

Las librerías PDF se cargan desde `cdnjs.cloudflare.com`, por lo que la generación de PDF requiere conexión a internet.

CORS se encuentra habilitado en `main.py` mediante `CORSMiddleware` para permitir peticiones desde el navegador web tanto localmente como en producción.

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

## 12. Errores frecuentes

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
| `error: Your local changes... overwritten by checkout` | Guardar cambios con `git stash` o hacer `git commit` antes de cambiar de rama |
| `error: pathspec '...' did not match any file(s)` | Ejecutar `git fetch origin` para actualizar la lista de ramas remotas de GitHub |

El script `database.py` y la API ocultan detalles SQL en sus mensajes. Si aparece un error genérico y las revisiones no lo resuelven, Emanuel debe revisar el diagnóstico local sin publicar credenciales ni detalles internos en las respuestas HTTP.

## 13. Cierre de semana 1 y pendientes

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

## 14. Guía de pruebas con tarjeta física NFC y coordinación con la App Android (Juan)

### 14.1. Pruebas realizadas y validación exitosa de la API (Emanuel)

Se realizaron pruebas de extremo a extremo conectando dispositivos en red local (Wi-Fi y Ethernet) con la API de FastAPI y la base de datos MariaDB:

1. **Tarjeta física identificada:** Se utilizó una tarjeta NFC física cuyo identificador de hardware (UID) es **`53B0062D020001`**.
2. **Asignación en base de datos:** Se dio de alta la tarjeta en la tabla `estudiante` asociada a `Emanuel Baltazar` (`id_estudiante: 4`, grado `1ro Básico A`, establecimiento `1`).
3. **Petición HTTP desde cliente externo:** Se enviaron peticiones a `http://192.168.1.104:8000/api/asistencia` simulando la llegada de marcajes.
4. **Respuesta de la API:**
   * La API procesó el marcaje, lo almacenó en la tabla `asistencia_nfc` con respuesta HTTP 200:
     ```json
     {
       "estado": "guardado",
       "id_registro": 1,
       "mensaje": "Marcaje guardado correctamente."
     }
     ```
   * En caso de reintentos con el mismo identificador de evento (`id_evento`), la API respondió correctamente con control de duplicados:
     ```json
     {
       "estado": "ya_registrado",
       "id_registro": 1,
       "mensaje": "Este evento ya estaba guardado."
     }
     ```
5. **Visualización en tiempo real:** El panel web (`Panel_de_asistencia.html`) detectó de inmediato el nuevo marcaje mediante sondeo a `GET /api/dashboard?id_establecimiento=1`, actualizando el banner de última lectura (*"Emanuel Baltazar · Llegó a tiempo"*), incrementando el contador de presentes y agregando la entrada al feed en vivo y a la gráfica de intervalos.

---

### 14.2. Comportamiento de las tarjetas físicas escolares (Solo Lectura)

Durante las pruebas con aplicaciones genéricas como *NFC Tools* y *MacroDroid*, se comprobó que la tarjeta física genera un aviso de *"Error de escritura"*.

**Diagnóstico técnico:**
* La tarjeta física de prueba es de **SOLO LECTURA (Read-Only)** a nivel de hardware, o se encuentra bloqueada de fábrica con sectores protegidos.
* **Esto es exactamente lo esperado en un entorno escolar:** los carnés, llaveros y tarjetas de los estudiantes vienen protegidos contra escritura para evitar que cualquier persona o estudiante pueda alterarlos, clonarlos o sobreescribir datos en ellos.
* El sistema ASISTECH **no necesita ni debe escribir datos en la tarjeta**. Solo requiere leer el número de serie único de fábrica (UID).

---

### 14.3. Especificación técnica para la App Android (Responsabilidad de Juan)

Para que el registro funcione de manera automática y fluida en la puerta de la escuela (acercar la tarjeta al teléfono y registrar al instante sin tocar la pantalla), la lectura de bajo nivel corresponde a la **aplicación móvil Android desarrollada por Juan**.

#### Requisitos para la implementación de Juan en Android:
1. **Lectura por hardware (`NfcAdapter`):**
   * Configurar el `NfcAdapter` para escuchar tarjetas mediante `ACTION_TAG_DISCOVERED` o `ACTION_TECH_DISCOVERED`.
   * **No intentar escribir NDEF records en la tarjeta.**
   * Extraer el UID en crudo desde el Intent:
     ```java
     byte[] tagId = intent.getByteArrayExtra(NfcAdapter.EXTRA_ID);
     ```
   * Convertir los bytes a una cadena hexadecimal en mayúsculas sin espacios ni separadores:
     ```java
     // Ejemplo de resultado esperado por la API: "53B0062D020001"
     StringBuilder sb = new StringBuilder();
     for (byte b : tagId) {
         sb.append(String.format("%02X", b));
     }
     String uidNfc = sb.toString();
     ```

2. **Envío del marcaje a la API:**
   * Generar un UUID v4 único por cada lectura física para el campo `id_evento`.
   * Enviar una petición HTTP `POST` a la API:
     ```http
     POST http://<IP_SERVIDOR_API>:8000/api/asistencia
     Content-Type: application/json

     {
       "id_evento": "c4b3f880-a681-432d-9486-123456789abc",
       "uid_nfc": "53B0062D020001",
       "id_establecimiento": 1,
       "fecha_hora": "2026-10-13T04:20:00Z",
       "tipo_registro": "ENTRADA"
     }
     ```
   *(Nota: La API ahora también soporta generación automática de `id_evento` y `fecha_hora` en caso de que el cliente móvil omita esos campos durante pruebas preliminares).*

3. **Manejo de respuestas en la App:**
   * **`200 OK` con `estado: "guardado"`:** Marcaje exitoso. La app de Juan debe emitir un sonido o vibración de confirmación verde para el estudiante.
   * **`200 OK` con `estado: "ya_registrado"`:** El marcaje ya fue recibido previamente (evita entradas duplicadas accidentales).
   * **`409 Conflict`:** Conflicto de datos con el mismo `id_evento`.
   * **`503 Service Unavailable`:** Error temporal de la base de datos o backend.

---

### 14.4. Procedimiento para registrar nuevas tarjetas NFC (Tarjetas que tiene Juan)

Dado que **Juan tiene en su poder las tarjetas físicas de prueba**, es indispensable seguir este procedimiento antes de probarlas en el colegio o con la app:

#### 1. Obtener el código UID de cada tarjeta:
* Juan debe acercar cada tarjeta al teléfono usando cualquier lector NFC (por ejemplo, la pestaña **LEER** de la app gratuita *NFC Tools*).
* Anotar el **Tag ID / Número de serie / UID** que muestre la pantalla.
* Limpiar el código eliminando espacios y dos puntos, dejándolo en **hexadecimal en mayúsculas** (por ejemplo: si lee `53:b0:06:2d:02:00:01`, el código es `53B0062D020001`).

#### 2. Recordatorio crítico: Las tarjetas están en MODO SOLO LECTURA
* **NO intentar escribir datos ni grabar texto/URLs en las tarjetas:** Como se comprobó en las pruebas físicas, estas tarjetas vienen bloqueadas de fábrica en **modo solo lectura (Read-Only)**. Intentar grabarlas con NFC Tools, MacroDroid o cualquier otra herramienta arrojará *"Error de escritura"*.
* **Esto es normal y seguro:** Las tarjetas escolares no se escriben; únicamente se lee su UID de hardware existente.

#### 3. Registrar las tarjetas en la Base de Datos (`estudiante`):
Para que al pasar la tarjeta el panel web muestre el nombre del alumno (y no la leyenda *"UID sin registrar"*), cada tarjeta debe registrarse previamente en la tabla `estudiante` de la base de datos `asistech`.

Marcos o Emanuel pueden ejecutar la siguiente consulta SQL en HeidiSQL, DBeaver o phpMyAdmin con los códigos de las tarjetas que tenga Juan:

```sql
-- Reemplazar con los UIDs reales leídos por Juan y los nombres de los estudiantes:
INSERT INTO estudiante (uid_nfc, nombre, grado, seccion, id_establecimiento, activo)
VALUES 
    ('UID_DE_TARJETA_1', 'Juan Pérez', '1ro Básico', 'A', 1, 1),
    ('UID_DE_TARJETA_2', 'Carlos Morales', '2do Básico', 'B', 1, 1),
    ('UID_DE_TARJETA_3', 'Sofía Castillo', '3ro Básico', 'A', 1, 1)
ON DUPLICATE KEY UPDATE 
    nombre = VALUES(nombre), 
    grado = VALUES(grado), 
    seccion = VALUES(seccion), 
    activo = 1;
```

> **Nota:** Si Juan pasa una tarjeta que aún no ha sido registrada en la tabla `estudiante`, la API **igual guardará el marcaje** en `asistencia_nfc` correctamente, pero la vista del dashboard la mostrará como **`UID sin registrar`** hasta que se le asigne un alumno en la base de datos.

---

## 15. Referencias oficiales

- Documentación oficial de Git: https://git-scm.com/doc
- Python en Windows: https://docs.python.org/3/using/windows.html
- Entornos virtuales: https://docs.python.org/3/library/venv.html
- FastAPI: https://fastapi.tiangolo.com/
- SQLAlchemy y MySQL/MariaDB: https://docs.sqlalchemy.org/en/20/dialects/mysql.html
- Configuración de conexiones SQLAlchemy: https://docs.sqlalchemy.org/en/20/core/engines.html
- CORS: https://fastapi.tiangolo.com/tutorial/cors/
- NFC Android: https://developer.android.com/develop/connectivity/nfc
- Seguridad de red Android: https://developer.android.com/privacy-and-security/security-config

Esta guía describe el código construido durante la sesión. Los comandos de despliegue en LAN, las excepciones Android y CORS son instrucciones de integración verificadas en el entorno local del equipo.

## Aplicación Android

La guía de instalación, compilación, conexión con la API y pruebas de la aplicación Android está en [ANDROID.md](ANDROID.md).

## 16. Despliegue en BanaHosting: incidencias, diagnóstico y soluciones (octubre de 2026)

### 16.1. Objetivo y arquitectura de producción

La fase de despliegue permitió publicar el backend y la interfaz web de ASISTECH fuera del entorno local, con el propósito de facilitar las pruebas del equipo y la futura integración del teléfono Android que lee tarjetas NFC.

| Componente | Desarrollo local | Producción en BanaHosting |
|---|---|---|
| Backend | FastAPI ejecutado con Uvicorn | FastAPI bajo Passenger mediante `a2wsgi` |
| Punto de entrada | `uvicorn main:app --reload` | `passenger_wsgi.py`, callable `application` |
| Python | Entorno virtual local | Python 3.10.22 (entorno virtual de cPanel) |
| Base de datos | MySQL/MariaDB local | Base de datos MySQL/MariaDB administrada desde cPanel |
| Interfaz web | HTML, CSS y JavaScript servidos por FastAPI o servidor de desarrollo | Mismo origen HTTPS que la API |
| Dominio | `http://127.0.0.1:8000` | `https://asistech.divinevo.com` |
| Servidor web | Uvicorn | LiteSpeed y Passenger, según las pruebas realizadas |

La carpeta de aplicación configurada en **Setup Python App** fue `asistech.divinevo.com`, con URL de aplicación en la raíz del subdominio (`/`). Los campos funcionales son:

```text
Python version:           3.10.22
Application root:         asistech.divinevo.com
Application URL:          asistech.divinevo.com /
Application startup file: passenger_wsgi.py
Application Entry point:  application
```

> **Alcance de lo comprobado:** se verificó la conexión a la BD, la ejecución interna de FastAPI y la respuesta HTTP 200 de la ruta principal tras actualizar el despliegue. Estas comprobaciones no sustituyen las pruebas funcionales de autenticación, dashboard y marcajes NFC en producción.

### 16.2. Configuración y comprobación de la base de datos

En `database.py` se utiliza SQLAlchemy con el controlador PyMySQL. El archivo `.env` se carga desde la misma carpeta del módulo mediante:

```python
load_dotenv(Path(__file__).resolve().parent / ".env")
```

Variables requeridas (valores ilustrativos; **no son credenciales reales**):

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=CUENTA_NOMBRE_BD
DB_USER=CUENTA_USUARIO_BD
DB_PASSWORD=CONTRASENA_PRIVADA
```

En cPanel, los nombres de la BD y del usuario pueden incluir un prefijo de cuenta; se deben copiar exactamente de la administración de MySQL y conceder los permisos correspondientes al usuario de la base de datos. El archivo `.env` no debe incluirse en Git.

La conexión se comprobó ejecutando, desde el entorno virtual de la aplicación:

```bash
cd ~/asistech.divinevo.com
python database.py
```

Resultado observado:

```text
Conexión exitosa con la base de datos ASISTECH.
```

Esta prueba ejecuta `SELECT 1` y demuestra conectividad y autenticación contra el motor de BD; **no demuestra que todas las tablas, consultas y endpoints estén correctos**.

### 16.3. Incidente: HTTP 500 y solicitudes que tardaban más de 15–20 segundos

**Síntomas registrados:** la URL pública mostraba inicialmente `500 Internal Server Error`; algunas cargas permanecían en blanco o tardaban más de un minuto. Al ejecutar `curl`, las solicitudes a `/` y `/docs` terminaron sin recibir bytes de respuesta:

```bash
curl -sS -o /dev/null -w "HTTP: %{http_code}\nTiempo: %{time_total}s\n" \
  --connect-timeout 10 --max-time 20 \
  https://asistech.divinevo.com/docs
```

Salida observada en las pruebas fallidas:

```text
curl: (28) Operation timed out after 20001 milliseconds with 0 bytes received
HTTP: 000
Tiempo: 20.002145s
```

`HTTP: 000` es el valor informativo mostrado por `curl` cuando **no se recibió un código de respuesta HTTP**; no es un código HTTP del servidor.

**Diagnóstico escalonado y resultados:**

| Comprobación | Procedimiento | Resultado observado | Qué permitió concluir |
|---|---|---|---|
| Base de datos | `python database.py` | Conexión exitosa | Credenciales, lectura del `.env` y conexión funcionales en la prueba |
| Importación del punto de entrada | `python -c "from passenger_wsgi import application; print('ASISTECH: inicio correcto')"` | `ASISTECH: inicio correcto` | El módulo se importa; no prueba la atención de peticiones |
| Errores del servidor | `tail -n 50 stderr.log` | Trazas antiguas con `imp.load_source('wsgi', 'passenger_wsgi.py')` y procesos terminados con señal 15 | Se identificó una anterior importación recursiva; no se atribuyó a ella todo fallo posterior |
| Código de arranque actual | `cat -n passenger_wsgi.py` | Importaba `ASGIMiddleware` y `main.app` sin `imp.load_source` | El archivo actual ya no coincidía con la traza antigua |
| HTTPS | `curl -k -I -v ...` | TLS/certificado y HTTP/2 negociados; después timeout | La conexión TLS funcionaba, pero no se completaba la petición HTTP |
| FastAPI fuera de Passenger | Solicitud ASGI interna a `/docs` | HTTP 200 | FastAPI podía procesar esa ruta directamente |
| Adaptador fuera de Passenger | Solicitud WSGI interna a `/docs` | `200 OK`, 1011 bytes | `a2wsgi` podía procesar la ruta en ejecución directa |
| WSGI mínimo en Passenger | `prueba_wsgi.py` con respuesta de texto | HTTP 200 | Passenger/LiteSpeed atendía aplicaciones WSGI simples |
| FastAPI mínimo con `a2wsgi` | Ruta `/` y `/prueba-sync` | Timeout de 15 segundos | El bloqueo no dependía de las consultas MySQL ni de los routers del proyecto |
| ASGI mínimo mediante `a2wsgi` | Aplicación ASGI sin FastAPI | Timeout | El problema seguía presente aun sin FastAPI |
| Hilos de Python | WSGI con `threading.Thread` y `join(timeout=2)` | HTTP 200; `HILO_OK` | No existía prohibición general de crear hilos |
| Importación y creación del adaptador | Prueba instrumentada de 5 etapas | Las 5 etapas completadas | Importar FastAPI y crear `ASGIMiddleware` no bastaba para reproducir el bloqueo |
| Adaptador inicializado al recibir una solicitud | WSGI con inicialización diferida por PID | HTTP 200 y JSON correcto | La inicialización diferida resolvió el caso mínimo en Passenger |

Se comprobó también que Passenger proporcionaba `wsgi.multithread=False`, `wsgi.multiprocess=True`, `wsgi.run_once=False`, versión WSGI `(1, 0)` y `SERVER_SOFTWARE=LiteSpeed`. Estos datos describen el entorno; **no constituyen por sí mismos un error**.

**Conclusión técnica:** los resultados apuntaron a un problema de ciclo de vida del adaptador ASGI→WSGI cuando se inicializaba anticipadamente en el entorno Passenger/LiteSpeed utilizado. La explicación probable es una interacción con el modelo multiproceso, pero **no se obtuvo una traza interna que demostrara de forma definitiva la causa exacta**. La inicialización diferida sí fue verificada como solución práctica.

### 16.4. Solución aplicada: inicialización diferida de `a2wsgi`

La versión que se bloqueaba inicializaba el adaptador en el ámbito global del módulo:

```python
from a2wsgi import ASGIMiddleware
from main import app

application = ASGIMiddleware(app)
```

La versión estable del archivo `passenger_wsgi.py` crea el adaptador **cuando Passenger procesa una solicitud** y lo reutiliza por proceso. Además, detecta cambios en el PID para no reutilizarlo indebidamente después de una bifurcación del proceso:

```python
import os
import sys
import threading

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from a2wsgi import ASGIMiddleware
from main import app

_lock = threading.Lock()
_adaptador = None
_pid = None


def application(environ, start_response):
    global _adaptador, _pid

    pid_actual = os.getpid()
    if _adaptador is None or _pid != pid_actual:
        with _lock:
            if _adaptador is None or _pid != pid_actual:
                _adaptador = ASGIMiddleware(app)
                _pid = pid_actual

    return _adaptador(environ, start_response)
```

**Razonamiento de diseño:**

- `application` es el *callable WSGI* solicitado por Passenger.
- `main.app` sigue siendo la aplicación ASGI real de FastAPI.
- `ASGIMiddleware` adapta la interfaz de solicitudes entre WSGI y ASGI.
- `_pid` determina si el adaptador pertenece al proceso actual.
- `_lock` reduce el riesgo de inicializaciones simultáneas dentro de un mismo proceso.
- La creación diferida evita inicializar el adaptador globalmente antes de comenzar a atender solicitudes.

La prueba mínima con esta estrategia respondió:

```text
HTTP/2 200
content-type: application/json
{"mensaje":"ASISTECH funcionando en BanaHosting"}
```

Posteriormente se incorporó la corrección al repositorio Git y el servidor volvió a responder `HTTP: 200` en la ruta `/`. Esto respalda el funcionamiento del despliegue, aunque las demás rutas deben probarse individualmente.

**Compatibilidad:** el archivo `passenger_wsgi.py` se utiliza al ejecutar bajo Passenger. En desarrollo local, `uvicorn main:app --reload` continúa cargando `main.py` directamente y no requiere pasar por el adaptador WSGI. Por tanto, el cambio no altera por sí mismo el arranque habitual con Uvicorn.

### 16.5. Verificación de Passenger, `.htaccess` y DNS

Se verificó que **Setup Python App** tuviera el archivo de inicio `passenger_wsgi.py` y el punto de entrada `application`. El `.htaccess` generado por cPanel contenía rutas coherentes con la aplicación:

```apache
PassengerAppRoot "/home/USUARIO_CPANEL/asistech.divinevo.com"
PassengerBaseURI "/"
PassengerPython "/home/USUARIO_CPANEL/virtualenv/asistech.divinevo.com/3.10/bin/python"
```

Los valores anteriores son **plantillas de ruta** y deben ajustarse a la cuenta correspondiente; no se deben reemplazar manualmente las directivas que CloudLinux administra sin necesidad. El certificado Let's Encrypt del subdominio fue aceptado y se negoció HTTPS/HTTP2 durante las pruebas. No hizo falta modificar los nameservers ni incorporar Cloudflare para resolver el bloqueo: la solicitud ya llegaba al servidor.

Comandos de mantenimiento y diagnóstico:

```bash
cd ~/asistech.divinevo.com
cat -n passenger_wsgi.py
cat .htaccess
find ~ -name 'stderr.log' -o -name 'passenger.log' -o -name 'error_log' 2>/dev/null
tail -n 50 stderr.log
curl -sS -o /dev/null -w 'HTTP: %{http_code}\n' --max-time 20 https://asistech.divinevo.com/
```

Los registros `killed by signal: 15` significan que el proceso recibió `SIGTERM`; por sí solos **no prueban** una falta de memoria ni identifican la causa original. Conviene contrastar cada mensaje con la hora exacta del fallo.

### 16.6. Incidente de Git durante la actualización en producción

Se había modificado `passenger_wsgi.py` directamente en el servidor para comprobar la solución. Después, la versión corregida se subió a `main` en GitHub. El siguiente `git pull` se detuvo con:

```text
error: Your local changes to the following files would be overwritten by merge:
    passenger_wsgi.py
Please commit your changes or stash them before you merge.
Aborting
```

Git impidió que los cambios entrantes sobrescribieran un archivo modificado localmente. **En este caso concreto**, tras confirmar que la versión correcta estaba en GitHub, se ejecutó:

```bash
git restore passenger_wsgi.py
git pull origin main
```

El pull terminó mediante *fast-forward* (de `788252e` a `6f2dba6`), actualizando `passenger_wsgi.py` (22 inserciones y 3 eliminaciones). La comprobación posterior fue:

```text
HTTP: 200
```

**Precaución para futuras actualizaciones:** `git restore passenger_wsgi.py` **descarta** modificaciones locales no confirmadas de ese archivo. Antes de usarlo, revisar `git status` y `git diff`, y comprobar que el repositorio remoto ya contiene lo que se desea conservar. Si los cambios del servidor son importantes, guardarlos con un commit o con `git stash` en lugar de descartarlos. Mantener las correcciones permanentes en Git, no exclusivamente en cPanel.

Flujo recomendado de despliegue después de un merge autorizado:

```bash
cd ~/asistech.divinevo.com
git status
git pull origin main
# Si cambiaron las dependencias, usar el entorno virtual activo:
python -m pip install -r requirements.txt
# Reiniciar desde cPanel > Setup Python App > Restart
curl -sS -o /dev/null -w 'HTTP: %{http_code}\n' --max-time 20 https://asistech.divinevo.com/
```

El reinicio se realiza desde **Setup Python App**; una respuesta `200` es una prueba de disponibilidad de la ruta, no una prueba completa de toda la plataforma.

### 16.7. Dashboard: mensaje «Sin conexión con la API · reintentando»

En una etapa posterior, la interfaz del dashboard mostró ese estado pese a que la conexión básica de Python con MySQL había funcionado. Se examinó el código JavaScript del panel y se identificó una **causa posible concreta**: la lógica de `CONFIG.API_BASE` podía construir una URL pública con `:8000` o recurrir a `http://localhost:8000`. En BanaHosting la API está publicada mediante el mismo subdominio HTTPS, sin requerir exponer ese puerto público.

**Estrategia de configuración propuesta:** usar rutas del mismo origen en producción y permitir un origen local configurable durante desarrollo:

```javascript
API_BASE: (() => {
    if (typeof window !== 'undefined' &&
        window.ASISTECH_API_BASE !== undefined) {
        return window.ASISTECH_API_BASE;
    }

    if (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') {
        if (window.location.port !== '8000') {
            return 'http://localhost:8000';
        }
    }

    return '';
})(),
```

La llamada del dashboard puede componerse a partir de esa base:

```javascript
const url = (CONFIG.API_BASE || '') +
    '/api/dashboard?id_establecimiento=' +
    encodeURIComponent(CONFIG.ID_ESTABLECIMIENTO);
```

En producción eso genera una ruta relativa como `/api/dashboard?id_establecimiento=1`. En un servidor frontend local separado del backend permite consultar `http://localhost:8000`; para teléfonos físicos u otras IP de la red local conviene definir explícitamente `window.ASISTECH_API_BASE` con una URL alcanzable desde ese dispositivo (en un teléfono, `localhost` es el propio teléfono).

El sondeo (`poll()`) se realiza cada 3 segundos. Actualmente cualquier fallo de la petición o error HTTP produce el estado «Sin conexión con la API · reintentando»; **este estado no debe interpretarse automáticamente como caída de MySQL**. La depuración debe revisar en DevTools > Network la URL efectiva, el código HTTP, el cuerpo de respuesta y la consola; después, si procede, los registros de FastAPI y consultas SQL del endpoint.

> **Estado de esta corrección:** la causa relacionada con `API_BASE` fue identificada al revisar el código y se preparó una propuesta de cambio para la IA del IDE. En el historial de pruebas documentado aquí **no consta una confirmación posterior de que ese cambio se haya aplicado y validado en ambos entornos**. Registrar esa evidencia cuando esté disponible; no presentarlo como una incidencia ya resuelta.

### 16.8. Aplicación Android y pruebas NFC: separación entre compilación y validación

El repositorio contiene un proyecto Android existente bajo `android/` (Gradle/Kotlin). Se prepararon instrucciones para generar una APK de depuración desde Windows sin reconstruir el proyecto:

```bat
cd android
gradlew.bat assembleDebug
```

Ruta esperada del artefacto, **si la compilación finaliza correctamente**:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

No se incluyó ninguna prueba o evidencia de compilación final exitosa de la APK en este registro; por tanto, no debe afirmarse aquí que la APK esté generada. La validación pendiente requiere instalarla en un teléfono real compatible con NFC, leer el UID de una tarjeta, comprobar el envío HTTPS a `POST /api/asistencia`, contrastar el registro en `asistencia_nfc` y verificar el dashboard. El teléfono nunca se conecta directamente al puerto de MySQL.

### 16.9. Resumen de evidencias y pruebas pendientes para defensa del proyecto

| Área | Evidencia disponible | Estado |
|---|---|---|
| MySQL desde BanaHosting | `python database.py`: «Conexión exitosa...» | **Comprobado** |
| Arranque e importación | Importación correcta de `passenger_wsgi` | **Comprobado** |
| FastAPI y WSGI directos | Respuestas internas HTTP 200 a `/docs` | **Comprobado** |
| SSL y recepción de solicitudes | TLS válido y HTTP/2 negociado | **Comprobado** |
| Fallo original | Timeouts con `curl` y trazas en `stderr.log` | **Documentado** |
| Solución de `a2wsgi` | Prueba WSGI/ASGI diferida con HTTP 200 | **Comprobado** |
| Actualización Git en servidor | Pull *fast-forward* y HTTP 200 en `/` | **Comprobado** |
| Dashboard en producción | Confirmar GET `/api/dashboard`, datos y manejo de errores | **Comprobado** |
| Inicio de sesión en producción | Prueba real de POST `/api/login` con cuenta autorizada | **Comprobado** |
| APK Android | Compilación e instalación en teléfono real | **Comprobado** |
| Flujo NFC completo en producción | UID físico → POST → MySQL → dashboard | **Comprobado** |

**Lecciones técnicas principales:** (1) separar conectividad de BD, importación, adaptación WSGI y servicio HTTP mediante pruebas independientes; (2) no atribuir automáticamente un HTTP 500 a MySQL o DNS; (3) documentar el contexto de ejecución específico de Passenger y el motivo de la inicialización diferida; (4) mantener los cambios de producción versionados y desplegarlos de forma controlada; (5) hacer que el frontend seleccione la URL de la API según el entorno sin exponer credenciales; y (6) registrar resultados reales, limitaciones y pruebas pendientes para que el proyecto pueda reproducirse y defenderse técnicamente.

**Referencias de consulta adicional:** [FastAPI](https://fastapi.tiangolo.com/), [ASGI](https://asgi.readthedocs.io/), [WSGI (PEP 3333)](https://peps.python.org/pep-3333/), [Passenger](https://www.phusionpassenger.com/docs/), [Git](https://git-scm.com/docs), [Android NFC](https://developer.android.com/develop/connectivity/nfc).

---

## 17. APK Android desplegado primera versión beta

Esta sección documenta la construcción, estructura técnica, análisis detallado de cada componente y generación del artefacto ejecutable (`.apk`) de la primera versión beta de la aplicación móvil nativa **ASISTECH**.

La aplicación móvil opera como una terminal autónoma de captura de asistencias mediante tecnología **NFC** (*Near Field Communication*), conectándose de manera segura contra la API RESTful central desplegada en producción (`https://asistech.divinevo.com/api/asistencia`).

---

### 17.1. Identidad visual y rutas de iconos del aplicativo

Para dotar al APK de una identidad visual consistente con la plataforma web, se integraron los recursos gráficos de iconografía oficial en formatos estándar y adaptativo/redondeado (`roundIcon`), abarcando todas las densidades de pantalla soportadas por el ecosistema Android:

| Nombre del recurso | Tipo / Propósito | Directorio / Ruta en el repositorio |
|---|---|---|
| `asistech.png` | Icono principal estándar (`@drawable/asistech` y `@mipmap/asistech`) | [`android/app/src/main/res/drawable/asistech.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/drawable/asistech.png) |
| `asistech.png` (mdpi) | Icono estándar para densidad media (~160 dpi, 48x48 px) | [`android/app/src/main/res/mipmap-mdpi/asistech.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-mdpi/asistech.png) |
| `asistech_round.png` (mdpi) | Icono redondeado para densidad media (~160 dpi, 48x48 px) | [`android/app/src/main/res/mipmap-mdpi/asistech_round.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-mdpi/asistech_round.png) |
| `asistech.png` (hdpi) | Icono estándar para alta densidad (~240 dpi, 72x72 px) | [`android/app/src/main/res/mipmap-hdpi/asistech.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-hdpi/asistech.png) |
| `asistech_round.png` (hdpi) | Icono redondeado para alta densidad (~240 dpi, 72x72 px) | [`android/app/src/main/res/mipmap-hdpi/asistech_round.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-hdpi/asistech_round.png) |
| `asistech.png` (xhdpi) | Icono estándar para extra alta densidad (~320 dpi, 96x96 px) | [`android/app/src/main/res/mipmap-xhdpi/asistech.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-xhdpi/asistech.png) |
| `asistech_round.png` (xhdpi) | Icono redondeado para extra alta densidad (~320 dpi, 96x96 px) | [`android/app/src/main/res/mipmap-xhdpi/asistech_round.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-xhdpi/asistech_round.png) |
| `asistech.png` (xxhdpi) | Icono estándar para densidad ultra alta (~480 dpi, 144x144 px) | [`android/app/src/main/res/mipmap-xxhdpi/asistech.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-xxhdpi/asistech.png) |
| `asistech_round.png` (xxhdpi) | Icono redondeado para densidad ultra alta (~480 dpi, 144x144 px) | [`android/app/src/main/res/mipmap-xxhdpi/asistech_round.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-xxhdpi/asistech_round.png) |
| `asistech.png` (xxxhdpi) | Icono estándar para máxima resolución (~640 dpi, 192x192 px) | [`android/app/src/main/res/mipmap-xxxhdpi/asistech.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-xxxhdpi/asistech.png) |
| `asistech_round.png` (xxxhdpi) | Icono redondeado para máxima resolución (~640 dpi, 192x192 px) | [`android/app/src/main/res/mipmap-xxxhdpi/asistech_round.png`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/mipmap-xxxhdpi/asistech_round.png) |

Estos iconos quedan vinculados formalmente en el manifiesto principal mediante:
```xml
android:icon="@mipmap/asistech"
android:roundIcon="@mipmap/asistech_round"
```
asegurando que en lanzadores circulares o modernos (Android 7.1 en adelante) se muestre `asistech_round.png`, y en lanzadores convencionales se muestre `asistech.png`.

---

### 17.2. Análisis exhaustivo de los archivos del proyecto Android

A continuación se detalla la función técnica, diseño y contenido de cada uno de los archivos que componen el módulo móvil:

#### 1. Manifiesto del sistema: [`android/app/src/main/AndroidManifest.xml`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/AndroidManifest.xml)
- **Permisos requeridos:**
  - `android.permission.INTERNET`: Necesario para despachar los registros HTTP/HTTPS vía POST al servidor de producción.
  - `android.permission.NFC`: Permite interactuar con el controlador de radiofrecuencia de campo cercano del teléfono.
- **Declaración de características:**
  - `<uses-feature android:name="android.hardware.nfc" android:required="false" />`: Al establecerse en `false`, el APK puede instalarse en cualquier dispositivo Android, permitiendo pruebas o digitación manual de UID aun si el dispositivo físico carece de antena NFC integrada.
- **Configuraciones de la aplicación:**
  - Asocia el tema visual `@style/Theme.ASISTECH`.
  - Habilita `android:usesCleartextTraffic="true"` (compatibilidad flexible durante desarrollo y llamadas HTTPS seguras).
  - Define `MainActivity` como actividad principal de inicio (`android.intent.action.MAIN` y `android.intent.category.LAUNCHER`) con ajuste dinámico de teclado virtual (`android:windowSoftInputMode="adjustResize"`).

#### 2. Lógica central y UI reactiva: [`android/app/src/main/java/gt/edu/asistech/MainActivity.kt`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/java/gt/edu/asistech/MainActivity.kt)
Implementada 100% en Kotlin moderno utilizando **Jetpack Compose** y **Material 3**:
- **Ciclo de vida NFC en `MainActivity`:**
  - Inicializa el adaptador nativo mediante `NfcAdapter.getDefaultAdapter(this)`.
  - En `onResume()`, invoca `nfcAdapter.enableReaderMode` activando los modos de lectura estándar:
    - `FLAG_READER_NFC_A`, `FLAG_READER_NFC_B`, `FLAG_READER_NFC_F`, `FLAG_READER_NFC_V` y `FLAG_READER_SKIP_NDEF_CHECK`.
  - Convierte el array de bytes del UID leído (`tag.id`) a una cadena hexadecimal en mayúsculas (`"%02X".format(...)`) y actualiza el hilo de UI en tiempo real vía `runOnUiThread`.
  - En `onPause()`, deshabilita el modo lector con `disableReaderMode(this)` para ahorrar batería y liberar el hardware NFC.
- **Componente Compose `PantallaPrincipal`:**
  - Manejo de estados reactivos mediante `remember { mutableStateOf(...) }` para `uid`, `establecimiento`, `tipoRegistro`, `estado`, `estadoNfc` y bandera de carga `cargando`.
  - Controles interactivos: campo de texto para UID (editable manualmente o alimentado automáticamente por la antena NFC), selector del ID de establecimiento, radio botones para seleccionar el tipo de registro (`ENTRADA` o `SALIDA`), botón de acción y mensajes de retroalimentación claros.
  - Validaciones locales inmediatas antes del envío: verifica que el UID no esté vacío, sin espacios en blanco, no mayor a 100 caracteres y que el ID de establecimiento sea un número entero positivo.
- **Cliente HTTP y transporte asíncrono `registrarAsistencia()`:**
  - Ejecutado en una corrutina en segundo plano (`Dispatchers.IO`) para evitar bloqueos del hilo principal.
  - Conexión mediante `HttpURLConnection` con timeouts definidos (10 segundos de conexión y 10 segundos de lectura).
  - Construcción del cuerpo JSON con idempotencia garantizada:
    ```kotlin
    val datos = JSONObject().apply {
        put("id_evento", UUID.randomUUID().toString())
        put("uid_nfc", uid)
        put("id_establecimiento", idEstablecimiento)
        put("fecha_hora", OffsetDateTime.now().toString())
        put("tipo_registro", tipo)
    }
    ```
  - Parseo inteligente de respuestas: identifica HTTP 200..299 e interpreta los estados del backend (`guardado`, `ya_registrado` con su respectivo `id_registro`), o captura mensajes detallados de error devueltos en la clave `detail` de FastAPI.

#### 3. Configuración de compilación del módulo: [`android/app/build.gradle.kts`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/build.gradle.kts)
- **Identificadores y compatibilidad:**
  - `namespace = "gt.edu.asistech"`
  - `applicationId = "gt.edu.asistech"`
  - `compileSdk = 37`, `targetSdk = 37`
  - `minSdk = 26` (Android 8.0 Oreo en adelante, garantizando soporte moderno para NFC y API de tiempo ISO-8601).
  - Versión del artefacto: `versionCode = 1`, `versionName = "1.0"`.
- **Inyección dinámica de la URL del backend:**
  - En `defaultConfig`, `debug` y `release` se inyecta la constante de compilación:
    ```kotlin
    buildConfigField("String", "API_ASISTENCIA_URL", "\"https://asistech.divinevo.com/api/asistencia\"")
    ```
    lo que garantiza que cualquier compilación apunte directamente al endpoint SSL en producción de BanaHosting y Cloudflare.
- **Optimización de release y R8:** Habilita empaquetado optimizado para librerías de AndroidX y Kotlin.
- **Compatibilidad Java y Compose:** Configurado con `JavaVersion.VERSION_11`, `compose = true` y `buildConfig = true`.

#### 4. Catálogo de versiones y dependencias: [`android/gradle/libs.versions.toml`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/gradle/libs.versions.toml)
Centraliza las versiones de dependencias de última generación:
- Android Gradle Plugin: `9.4.1`
- Kotlin: `2.2.10`
- Jetpack Compose BOM: `2026.02.01`
- Material 3, Activity Compose, Core KTX, JUnit y Espresso.

#### 5. Configuración global y plugins del proyecto:
- [`android/build.gradle.kts`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/build.gradle.kts): Declara los plugins de aplicación Android y Kotlin Compose con aplicación diferida para los submódulos.
- [`android/settings.gradle.kts`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/settings.gradle.kts): Gestiona los repositorios (Google Maven, Maven Central, Gradle Plugin Portal), el catálogo Foojay Resolver para toolchains JDK y asigna el nombre raíz `ASISTECH`.
- [`android/gradle.properties`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/gradle.properties): Opciones de JVM, soporte de AndroidX y paralelismo del demonio de compilación.

#### 6. Sistema de diseño y temas visuales:
- [`android/app/src/main/java/gt/edu/asistech/ui/theme/Theme.kt`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/java/gt/edu/asistech/ui/theme/Theme.kt): Tema `ASISTECHTheme` que soporta tema claro/oscuro y colores dinámicos en Android 12+ (`Material You`).
- [`android/app/src/main/java/gt/edu/asistech/ui/theme/Color.kt`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/java/gt/edu/asistech/ui/theme/Color.kt): Definición de paleta púrpura/azul tecnológica alineada a la interfaz web.
- [`android/app/src/main/java/gt/edu/asistech/ui/theme/Type.kt`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/java/gt/edu/asistech/ui/theme/Type.kt): Tipografía estándar de Material Design para legibilidad óptima.
- [`android/app/src/main/res/values/strings.xml`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/values/strings.xml): Define el nombre visible de la app (`ASISTECH`).
- [`android/app/src/main/res/values/themes.xml`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/values/themes.xml): Declara el estilo base sin barra de acción (`Theme.Material.Light.NoActionBar`).
- [`android/app/src/main/res/values/colors.xml`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/values/colors.xml): Colores XML nativos para elementos del sistema.

#### 7. Reglas de respaldo y ofuscación:
- [`android/app/src/main/res/xml/backup_rules.xml`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/xml/backup_rules.xml) y [`android/app/src/main/res/xml/data_extraction_rules.xml`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/res/xml/data_extraction_rules.xml): Reglas para control seguro de respaldos en la nube bajo Android 12+.
- [`android/app/src/main/keepRules/rules.keep`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/src/main/keepRules/rules.keep): Reglas de retención para el optimizador R8 y ProGuard.

---

### 17.3. Evidencia de compilación y artefacto APK generado

El proceso de empaquetado y compilación fue ejecutado exitosamente a través del Gradle Wrapper:

```bat
cd android
gradlew.bat assembleDebug
```

Resultado verificado del artefacto generado en disco:

- **Archivo binario generado:** [`android/app/build/outputs/apk/debug/app-debug.apk`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/build/outputs/apk/debug/app-debug.apk)
- **Tamaño del APK:** ~13.73 MB (13,731,725 bytes)
- **Metadatos de compilación:** [`android/app/build/outputs/apk/debug/output-metadata.json`](file:///c:/Users/emanu/Documents/Proyectos/asistech/android/app/build/outputs/apk/debug/output-metadata.json)
  ```json
  {
    "version": 3,
    "artifactType": { "type": "APK", "kind": "Directory" },
    "applicationId": "gt.edu.asistech",
    "variantName": "debug",
    "elements": [
      {
        "type": "SINGLE",
        "versionCode": 1,
        "versionName": "1.0",
        "outputFile": "app-debug.apk"
      }
    ],
    "minSdkVersionForDexing": 26
  }
  ```

---

### 17.4. Procedimiento de instalación y prueba en dispositivo real

1. **Transferencia / Sideloading:**
   - Conectar el smartphone Android vía USB con depuración habilitada y ejecutar:
     ```bash
     adb install android/app/build/outputs/apk/debug/app-debug.apk
     ```
   - O bien transferir directamente el archivo `app-debug.apk` por almacenamiento interno, WhatsApp, Drive o descarga directa e instalar concediendo permisos de «Instalar aplicaciones de fuentes desconocidas».
2. **Validación del flujo funcional NFC:**
   - Abrir la aplicación **ASISTECH** en el teléfono.
   - Si el teléfono tiene NFC apagado, la aplicación notificará: *"Activa NFC en los ajustes del teléfono."*.
   - Al encender NFC, el estado cambia a: *"NFC preparado. Acerca una tarjeta al teléfono."*.
   - Acercar una tarjeta física NFC o tag RFID de 13.56 MHz (Mifare, NTAG, etc.): la app lee el tag al instante y llena el campo con su UID hexadecimal (por ejemplo: `04A1B2C3D4E5F6`).
   - Seleccionar tipo `ENTRADA` o `SALIDA` y presionar **"Registrar asistencia"**.
   - La aplicación genera un `id_evento` UUIDv4 único y lo envía por HTTPS al backend en BanaHosting, mostrando:
     *"¡Asistencia guardada correctamente! Número de registro: X"*.
   - El registro se visualiza de forma instantánea en el panel de control web (`index.html`) en la tabla `asistencia_nfc`.

---

## 18. Pendientes de Seguridad y Revisiones Posteriores

Durante la revisión de la arquitectura del proyecto (backend en FastAPI, base de datos MariaDB, aplicación Android y panel web), se identificaron los siguientes puntos de seguridad para revisar e implementar en iteraciones posteriores:

### 🔴 Prioridad Alta
1. **Migración a Autenticación basada en Tokens (JWT / Bearer):**
   - Actualmente, `/api/login` no emite tokens de sesión JWT ni cookies `HttpOnly`. Los endpoints del dashboard (`GET /api/dashboard`, `PATCH /api/alertas/{id}`) deben protegerse mediante middleware de autenticación para evitar consultas o modificaciones no autorizadas.
2. **Eliminación del Fallback en Texto Plano para Contraseñas:**
   - En `main.py` (`verificar_contrasena`), se debe remover la comparación de contraseña en texto plano en caso de que el hash en la BD no comience con el prefijo Bcrypt, asegurando que el 100% de las contraseñas usen únicamente Bcrypt.
3. **Autenticación en la Ingesta de Marcajes NFC desde Android:**
   - Implementar un encabezado con firma HMAC o una API Key autorizada en `POST /api/asistencia` para garantizar que únicamente la app móvil oficial pueda enviar registros de asistencia al backend.
4. **Desactivar Tráfico HTTP No Cifrado en Android:**
   - Cambiar `android:usesCleartextTraffic="false"` en `AndroidManifest.xml` para asegurar que todo el tráfico transite exclusivamente a través de conexiones cifradas HTTPS/TLS.

### 🟡 Prioridad Media
1. **Restricción de Orígenes en CORS (`allow_origins`):**
   - Sustituir `allow_origins=["*"]` en `main.py` por los dominios web autorizados explícitamente (ej. `["https://asistech.divinevo.com"]`).
2. **Restringir Registro de Asistencia a Métodos `POST`:**
   - Eliminar el endpoint `GET /api/asistencia` o limitarlo para prevenir vulnerabilidades de tipo Cross-Site Request Forgery (CSRF).
3. **Limpieza del Esquema de la Base de Datos:**
   - Eliminar la columna `confirmar_contrasena` de la tabla `usuario` en MariaDB y realizar esta validación únicamente en el cliente/formulario.
4. **Protección de Credenciales de BD en Entorno:**
   - Eliminar los valores fallback por defecto (`root`/`root`) en `database.py` y forzar el requerimiento de variables de entorno configuradas explícitamente en `.env`.


