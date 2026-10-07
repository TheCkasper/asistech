from datetime import timezone
from typing import Literal
from uuid import UUID

from fastapi import FastAPI, HTTPException
from pydantic import AwareDatetime, BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import engine

app = FastAPI(title="ASISTECH API")


class Marcaje(BaseModel):
    id_evento: UUID
    uid_nfc: str = Field(
        min_length=1, max_length=100, pattern=r"^\S+$"
    )
    id_establecimiento: int = Field(gt=0)
    fecha_hora: AwareDatetime
    tipo_registro: Literal["ENTRADA", "SALIDA"]


@app.get("/api/salud")
def comprobar_estado():
    return {"estado": "ok"}


@app.post("/api/asistencia")
def recibir_asistencia(marcaje: Marcaje):
    datos = marcaje.model_dump()
    datos["id_evento"] = str(marcaje.id_evento)
    datos["fecha_hora"] = (
        marcaje.fecha_hora.astimezone(timezone.utc)
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