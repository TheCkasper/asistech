# ASISTECH Android

## Estado actual

La aplicación Android está desarrollada con Kotlin y Jetpack Compose.

Funcionalidades implementadas:
- Formulario para registrar asistencia.
- Selección de entrada o salida.
- Campo para UID de tarjeta o usuario.
- Envío de asistencia a la API REST.
- Lectura NFC mediante `NfcAdapter` y `enableReaderMode`.
- Visualización del resultado devuelto por la API.

## Requisitos

- Android Studio.
- JDK compatible con la versión de Gradle del proyecto.
- Android SDK configurado.
- Un dispositivo Android físico con NFC para probar tarjetas reales.
- Backend ASISTECH en ejecución.

## Estructura

- `app/src/main/java/gt/edu/asistech/MainActivity.kt`: interfaz, lectura NFC y envío de asistencia.
- `app/src/main/AndroidManifest.xml`: permisos y configuración de la aplicación.
- `app/build.gradle.kts`: configuración del módulo Android.
- `gradle/`: wrapper y configuración de Gradle.

## Compilar en Windows

Desde PowerShell, entra en la carpeta Android:

```powershell
cd android
.\gradlew.bat assembleDebug
```

El APK de depuración se genera en:

`app/build/outputs/apk/debug/app-debug.apk`

## Instalar en un dispositivo conectado

Con las herramientas ADB instaladas y la depuración USB habilitada:

```powershell
.\gradlew.bat installDebug
```

También puedes instalar el APK desde Android Studio.

## Conexión con el backend

La aplicación utiliza el endpoint:

`POST /api/asistencia`

Actualmente, la dirección configurada en `MainActivity.kt` es:

`http://127.0.0.1:8000/api/asistencia`

En un emulador Android, `127.0.0.1` apunta al propio emulador. Para acceder al backend que se ejecuta en la computadora, se puede configurar el reenvío de puertos:

```powershell
adb reverse tcp:8000 tcp:8000
```

En un teléfono físico, esta configuración puede requerir una dirección accesible desde el teléfono o un reenvío ADB equivalente. El servidor debe estar en ejecución.

## Pruebas

1. Compilar con `assembleDebug`.
2. Abrir la aplicación.
3. Registrar un UID de prueba.
4. Verificar la respuesta de la API.
5. Confirmar el registro en la base de datos.
6. En un teléfono con NFC, acercar una tarjeta compatible y comprobar el UID leído.
7. Verificar que el UID leído se envíe correctamente a la API.

## Pendiente de validar

- Lectura de la tarjeta física con un teléfono Android compatible.
- Confirmar que el UID leído en Android coincide con el identificador esperado.
- Validar la integración completa con el backend en un dispositivo físico.
- Probar errores de conexión y el comportamiento cuando NFC está desactivado.

La lectura real de tarjetas no se considera validada hasta realizar las pruebas con hardware compatible.
