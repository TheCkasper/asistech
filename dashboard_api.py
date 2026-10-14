"""
ASISTECH - Endpoints de consulta para el dashboard (propuesta de Marcos para Emanuel).

Cómo integrarlo en el proyecto:
  1. Guardar este archivo como dashboard_api.py, junto a main.py y database.py.
  2. En main.py, después de crear `app`:
         from dashboard_api import router as dashboard_router
         app.include_router(dashboard_router)
  3. Habilitar CORS en main.py con el origen real del dashboard
     (ver la sección 11 del README). Si el dashboard se sirve con
     `python -m http.server 5173`, el origen es http://localhost:5173
     y el método GET y PATCH deben estar permitidos:
         allow_methods=["GET", "POST", "PATCH"]
  4. Ejecutar antes asistenciadb_marcos.sql (crea las tablas y vistas que usa este código)
     y poner DB_NAME=AsistenciaDB en el .env (respetando mayúsculas y minúsculas).

Supuesto no verificado: que database.py exporta `engine` (SQLAlchemy). Si el nombre
o la forma de importarlo es distinta, ajustar solo la línea de import.
"""

from datetime import timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text

from database import engine  # ajustar si el engine se importa distinto

router = APIRouter()


def _a_iso_utc(valor):
    """DATETIME guardado en UTC -> texto ISO 8601 con 'Z' (el dashboard convierte a hora de Guatemala)."""
    if valor is None:
        return ""
    if isinstance(valor, str):
        return valor if valor.endswith("Z") else valor + "Z"
    if hasattr(valor, "tzinfo") and valor.tzinfo is None:
        return valor.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    if hasattr(valor, "astimezone"):
        return valor.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return str(valor)


@router.get("/api/dashboard")
def dashboard(id_establecimiento: int = Query(1, gt=0)):
    """Resumen del día para el dashboard: total de estudiantes, lecturas de hoy y alertas abiertas."""
    try:
        with engine.connect() as conn:
            total = conn.execute(
                text(
                    "SELECT COUNT(*) FROM estudiante "
                    "WHERE activo = 1 AND id_establecimiento = :e"
                ),
                {"e": id_establecimiento},
            ).scalar_one()

            lecturas = conn.execute(
                text(
                    "SELECT id_registro, uid_nfc, nombre, grado, tipo_registro, fecha_hora "
                    "FROM vw_lecturas_hoy WHERE id_establecimiento = :e "
                    "ORDER BY fecha_hora, id_registro"
                ),
                {"e": id_establecimiento},
            ).mappings().all()

            alertas = conn.execute(
                text(
                    "SELECT id_alerta, nombre, grado, tipo, severidad, puntaje, descripcion "
                    "FROM vw_alertas_abiertas WHERE id_establecimiento = :e "
                    "ORDER BY FIELD(severidad, 'alta', 'media', 'baja'), puntaje DESC"
                ),
                {"e": id_establecimiento},
            ).mappings().all()
    except Exception as err:
        # Registrar detalle del error en consola para depuración
        print(f"[Error en /api/dashboard] {err}")
        raise HTTPException(status_code=503, detail="No se pudo consultar el dashboard.")

    return {
        "total_estudiantes": total,
        "lecturas": [
            {
                "id_registro": r["id_registro"],
                "uid_nfc": r["uid_nfc"],
                "nombre": r["nombre"],
                "grado": r["grado"],
                "tipo_registro": r["tipo_registro"],
                "fecha_hora": _a_iso_utc(r["fecha_hora"]),
            }
            for r in lecturas
        ],
        "alertas": [
            {
                "id_alerta": a["id_alerta"],
                "nombre": a["nombre"],
                "grado": a["grado"],
                "tipo": a["tipo"],
                "severidad": a["severidad"],
                "puntaje": float(a["puntaje"]),
                "descripcion": a["descripcion"],
            }
            for a in alertas
        ],
    }


class AlertaRevisada(BaseModel):
    revisada: Literal[True]  # solo se permite marcar como revisada


@router.patch("/api/alertas/{id_alerta}")
def marcar_alerta_revisada(id_alerta: int, cuerpo: AlertaRevisada):
    """Marca una alerta de la IA como revisada. Es idempotente: repetirla no da error."""
    try:
        with engine.begin() as conn:
            existe = conn.execute(
                text("SELECT 1 FROM alerta_ia WHERE id_alerta = :i"),
                {"i": id_alerta},
            ).first()
            if existe is None:
                raise HTTPException(status_code=404, detail="Alerta no encontrada.")
            conn.execute(
                text(
                    "UPDATE alerta_ia SET revisada = 1, revisada_en = NOW() "
                    "WHERE id_alerta = :i AND revisada = 0"
                ),
                {"i": id_alerta},
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo actualizar la alerta.")

    return {"estado": "revisada", "id_alerta": id_alerta}
