from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import UUID, uuid4

from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import engine
from dashboard_api import router as dashboard_router

app = FastAPI(title="ASISTECH API")

# Habilitar CORS para permitir peticiones desde navegadores, paneles web locales o externos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conectar endpoints del dashboard (/api/dashboard y PATCH /api/alertas/{id})
app.include_router(dashboard_router)

BASE_DIR = Path(__file__).resolve().parent

# Servir archivos estáticos de la interfaz web
if (BASE_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(BASE_DIR / "css")), name="css")
if (BASE_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(BASE_DIR / "js")), name="js")


import bcrypt

@app.get("/")
@app.get("/login")
def login_page():
    """Sirve la pantalla de inicio de sesión."""
    archivo_html = BASE_DIR / "login.html"
    if archivo_html.exists():
        return FileResponse(str(archivo_html), media_type="text/html; charset=utf-8")
    return {"mensaje": "ASISTECH API activa - Login"}


@app.get("/panel")
@app.get("/Panel_de_asistencia.html")
def panel():
    """Sirve el Panel de Asistencia."""
    archivo_html = BASE_DIR / "Panel_de_asistencia.html"
    if archivo_html.exists():
        return FileResponse(str(archivo_html), media_type="text/html; charset=utf-8")
    return {"mensaje": "Panel de asistencia no encontrado"}


class LoginRequest(BaseModel):
    usuario: str = Field(min_length=1, max_length=100)
    contrasena: str = Field(min_length=1)


def verificar_contrasena(contrasena_plana: str, hash_almacenado: str) -> bool:
    try:
        if not hash_almacenado:
            return False
        if hash_almacenado.startswith(("$2b$", "$2a$", "$2y$")):
            return bcrypt.checkpw(contrasena_plana.encode("utf-8"), hash_almacenado.encode("utf-8"))
        return contrasena_plana == hash_almacenado
    except Exception:
        return False


@app.post("/api/login")
def autenticar_usuario(datos: LoginRequest):
    """Autentica las credenciales del usuario contra la base de datos MariaDB."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text(
                    "SELECT id_usuario, nombre, apellido, usuario, contrasena, estado "
                    "FROM usuario WHERE usuario = :u LIMIT 1"
                ),
                {"u": datos.usuario.strip()},
            ).mappings().first()

            if not row:
                raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

            if row["estado"] != 1:
                raise HTTPException(status_code=403, detail="Tu usuario se encuentra inactivo. Contacta al administrador.")

            if not verificar_contrasena(datos.contrasena, row["contrasena"]):
                raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")

            return {
                "estado": "ok",
                "mensaje": "Inicio de sesión correcto",
                "usuario": {
                    "id_usuario": row["id_usuario"],
                    "nombre": row["nombre"],
                    "apellido": row["apellido"],
                    "usuario": row["usuario"],
                },
            }
    except HTTPException:
        raise
    except SQLAlchemyError as err:
        raise HTTPException(status_code=500, detail="Error al conectar con la base de datos.")


class Marcaje(BaseModel):
    id_evento: Optional[UUID] = None
    uid_nfc: str = Field(
        min_length=1, max_length=100, pattern=r"^\S+$"
    )
    id_establecimiento: int = Field(gt=0, default=1)
    fecha_hora: Optional[AwareDatetime] = None
    tipo_registro: Literal["ENTRADA", "SALIDA"] = "ENTRADA"


@app.get("/api/salud")
def comprobar_estado():
    return {"estado": "ok"}


@app.get("/api/asistencia")
def registrar_asistencia_nfc_link(
    uid_nfc: str = Query(..., min_length=1),
    id_establecimiento: int = Query(1),
    tipo_registro: Literal["ENTRADA", "SALIDA"] = "ENTRADA"
):
    """Permite registrar asistencia directamente cuando un celular lee una tarjeta NFC grabada con URL."""
    resultado = recibir_asistencia(Marcaje(
        uid_nfc=uid_nfc,
        id_establecimiento=id_establecimiento,
        tipo_registro=tipo_registro
    ))
    return HTMLResponse(content=f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Asistencia Registrada - ASISTECH</title>
      <style>
        body {{ font-family: system-ui, sans-serif; text-align: center; padding: 40px 20px; background: #0D1426; color: #fff; }}
        .card {{ background: #152039; border-radius: 16px; padding: 30px; max-width: 400px; margin: auto; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }}
        .check {{ font-size: 55px; color: #3DD598; }}
        h1 {{ margin: 15px 0 10px; font-size: 1.4rem; }}
        p {{ color: #9AA7C2; margin: 6px 0; }}
        .chip {{ display: inline-block; background: #23325E; color: #8FA6FF; padding: 6px 14px; border-radius: 999px; margin-top: 15px; font-weight: 600; font-size: 0.9rem; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="check">&#10004;</div>
        <h1>¡Marcaje Registrado!</h1>
        <p>UID: <b>{uid_nfc.upper()}</b></p>
        <div class="chip">{tipo_registro} REGISTRADA</div>
        <p style="margin-top: 20px; font-size: 0.85rem;">Marcaje guardado en ASISTECH. Puedes ver la actualización en vivo en el panel.</p>
      </div>
    </body>
    </html>
    """)


@app.post("/api/asistencia")
def recibir_asistencia(marcaje: Marcaje):
    datos = marcaje.model_dump()
    evento_id = marcaje.id_evento if marcaje.id_evento is not None else uuid4()
    datos["id_evento"] = str(evento_id)
    datos["uid_nfc"] = marcaje.uid_nfc.strip().upper()
    fh = marcaje.fecha_hora if marcaje.fecha_hora is not None else datetime.now(timezone.utc)
    datos["fecha_hora"] = (
        fh.astimezone(timezone.utc)
        .replace(tzinfo=None, microsecond=0)
    )

    try:
        try:
            with engine.begin() as conexion:
                resultado = conexion.execute(
                    text("""
                        INSERT INTO asistencia_nfc (
                            id_evento, uid_nfc, id_establecimiento,
                            fecha_hora, tipo_registro
                        )
                        VALUES (
                            :id_evento, :uid_nfc, :id_establecimiento,
                            :fecha_hora, :tipo_registro
                        )
                    """),
                    datos,
                )
                id_registro = resultado.lastrowid

        except IntegrityError:
            # La inserción fallida ya se revirtió.
            with engine.connect() as conexion:
                existente = conexion.execute(
                    text("""
                        SELECT id_registro, uid_nfc,
                               id_establecimiento, fecha_hora,
                               tipo_registro
                        FROM asistencia_nfc
                        WHERE id_evento = :id_evento
                    """),
                    {"id_evento": datos["id_evento"]},
                ).mappings().first()

            if existente is None:
                raise

            campos = (
                "uid_nfc", "id_establecimiento",
                "fecha_hora", "tipo_registro"
            )

            if any(existente[c] != datos[c] for c in campos):
                raise HTTPException(
                    status_code=409,
                    detail="El id_evento ya existe con otros datos."
                )

            return {
                "estado": "ya_registrado",
                "id_registro": existente["id_registro"],
                "mensaje": "Este evento ya estaba guardado."
            }

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="No se pudo guardar el marcaje."
        ) from None

    return {
        "estado": "guardado",
        "id_registro": id_registro,
        "mensaje": "Marcaje guardado correctamente."
    }