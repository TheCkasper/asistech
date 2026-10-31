"""
ASISTECH - Endpoints de consulta para el dashboard y gestión de estudiantes.
"""

from datetime import timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from database import engine

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
    revisada: Literal[True]


@router.patch("/api/alertas/{id_alerta}")
def marcar_alerta_revisada(id_alerta: int, cuerpo: AlertaRevisada):
    """Marca una alerta de la IA como revisada."""
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


# =====================================================================
# ENDPOINTS DE GESTIÓN DE ESTUDIANTES (CRUD Y REGISTRO DE ASISTENCIAS)
# =====================================================================

@router.get("/api/estudiantes")
def listar_estudiantes(
    id_establecimiento: int = Query(1, gt=0),
    buscar: Optional[str] = None
):
    """Obtiene el listado de estudiantes ligados a un establecimiento."""
    try:
        with engine.connect() as conn:
            sql = """
                SELECT e.id_estudiante, e.uid_nfc, e.nombre, e.grado, e.seccion,
                       e.id_establecimiento, e.activo, e.creado_en,
                       e.id_ciclo_escolar, e.id_grado, e.id_seccion, e.id_grado_seccion,
                       c.nombre AS ciclo_nombre
                FROM estudiante e
                LEFT JOIN ciclo_escolar c ON c.id_ciclo_escolar = e.id_ciclo_escolar
                WHERE e.id_establecimiento = :e
            """
            params = {"e": id_establecimiento}

            if buscar and buscar.strip():
                sql += " AND (LOWER(e.nombre) LIKE :b OR LOWER(e.uid_nfc) LIKE :b OR LOWER(CONCAT_WS(' ', e.grado, e.seccion)) LIKE :b)"
                params["b"] = f"%{buscar.strip().lower()}%"

            sql += " ORDER BY e.activo DESC, e.nombre ASC"

            filas = conn.execute(text(sql), params).mappings().all()

            return [
                {
                    "id_estudiante": f["id_estudiante"],
                    "uid_nfc": f["uid_nfc"],
                    "nombre": f["nombre"],
                    "grado": f["grado"] or "",
                    "seccion": f["seccion"] or "",
                    "id_establecimiento": f["id_establecimiento"],
                    "activo": bool(f["activo"]),
                    "creado_en": _a_iso_utc(f["creado_en"]),
                    "id_ciclo_escolar": f["id_ciclo_escolar"],
                    "id_grado": f["id_grado"],
                    "id_seccion": f["id_seccion"],
                    "id_grado_seccion": f["id_grado_seccion"],
                    "ciclo_nombre": f["ciclo_nombre"] or "2026",
                }
                for f in filas
            ]
    except Exception as err:
        print(f"[Error en /api/estudiantes] {err}")
        raise HTTPException(status_code=500, detail="Error al consultar estudiantes.")


class EstudianteCrear(BaseModel):
    uid_nfc: str = Field(..., min_length=1, max_length=100)
    nombre: str = Field(..., min_length=1, max_length=120)
    grado: Optional[str] = None
    seccion: Optional[str] = None
    id_establecimiento: int = Field(1, gt=0)
    activo: int = Field(1, ge=0, le=1)
    id_ciclo_escolar: Optional[int] = None
    id_grado: Optional[int] = None
    id_seccion: Optional[int] = None
    id_grado_seccion: Optional[int] = None


@router.post("/api/estudiantes")
def crear_estudiante(datos: EstudianteCrear):
    """Crea un nuevo estudiante en la base de datos."""
    uid_limpio = datos.uid_nfc.strip().upper()
    nombre_limpio = datos.nombre.strip()

    try:
        with engine.begin() as conn:
            # Verificar si el UID ya está asignado
            existente = conn.execute(
                text("SELECT id_estudiante FROM estudiante WHERE uid_nfc = :uid LIMIT 1"),
                {"uid": uid_limpio}
            ).first()

            if existente:
                raise HTTPException(
                    status_code=400,
                    detail=f"La tarjeta NFC ({uid_limpio}) ya está asignada a otro estudiante."
                )

            res = conn.execute(
                text("""
                    INSERT INTO estudiante (
                        uid_nfc, nombre, grado, seccion,
                        id_establecimiento, activo,
                        id_ciclo_escolar, id_grado, id_seccion, id_grado_seccion
                    )
                    VALUES (
                        :uid_nfc, :nombre, :grado, :seccion,
                        :id_establecimiento, :activo,
                        :id_ciclo_escolar, :id_grado, :id_seccion, :id_grado_seccion
                    )
                """),
                {
                    "uid_nfc": uid_limpio,
                    "nombre": nombre_limpio,
                    "grado": datos.grado.strip() if datos.grado else None,
                    "seccion": datos.seccion.strip() if datos.seccion else None,
                    "id_establecimiento": datos.id_establecimiento,
                    "activo": datos.activo,
                    "id_ciclo_escolar": datos.id_ciclo_escolar,
                    "id_grado": datos.id_grado,
                    "id_seccion": datos.id_seccion,
                    "id_grado_seccion": datos.id_grado_seccion,
                }
            )
            nuevo_id = res.lastrowid

            return {
                "estado": "ok",
                "mensaje": "Estudiante registrado exitosamente.",
                "id_estudiante": nuevo_id
            }
    except HTTPException:
        raise
    except Exception as err:
        print(f"[Error en POST /api/estudiantes] {err}")
        raise HTTPException(status_code=500, detail="No se pudo registrar el estudiante.")


class EstudianteActualizar(BaseModel):
    uid_nfc: str = Field(..., min_length=1, max_length=100)
    nombre: str = Field(..., min_length=1, max_length=120)
    grado: Optional[str] = None
    seccion: Optional[str] = None
    activo: int = Field(..., ge=0, le=1)
    id_ciclo_escolar: Optional[int] = None
    id_grado: Optional[int] = None
    id_seccion: Optional[int] = None
    id_grado_seccion: Optional[int] = None


@router.put("/api/estudiantes/{id_estudiante}")
def actualizar_estudiante(id_estudiante: int, datos: EstudianteActualizar):
    """Modifica la información o estado (Activo/Inactivo) de un estudiante existente."""
    uid_limpio = datos.uid_nfc.strip().upper()
    nombre_limpio = datos.nombre.strip()

    try:
        with engine.begin() as conn:
            # Verificar existencia del estudiante
            est = conn.execute(
                text("SELECT id_estudiante FROM estudiante WHERE id_estudiante = :id LIMIT 1"),
                {"id": id_estudiante}
            ).first()

            if not est:
                raise HTTPException(status_code=404, detail="Estudiante no encontrado.")

            # Verificar duplicidad de UID con otros estudiantes
            otro = conn.execute(
                text("SELECT id_estudiante FROM estudiante WHERE uid_nfc = :uid AND id_estudiante != :id LIMIT 1"),
                {"uid": uid_limpio, "id": id_estudiante}
            ).first()

            if otro:
                raise HTTPException(
                    status_code=400,
                    detail=f"La tarjeta NFC ({uid_limpio}) ya está asignada a otro estudiante."
                )

            conn.execute(
                text("""
                    UPDATE estudiante
                    SET uid_nfc = :uid_nfc,
                        nombre = :nombre,
                        grado = :grado,
                        seccion = :seccion,
                        activo = :activo,
                        id_ciclo_escolar = :id_ciclo_escolar,
                        id_grado = :id_grado,
                        id_seccion = :id_seccion,
                        id_grado_seccion = :id_grado_seccion
                    WHERE id_estudiante = :id
                """),
                {
                    "id": id_estudiante,
                    "uid_nfc": uid_limpio,
                    "nombre": nombre_limpio,
                    "grado": datos.grado.strip() if datos.grado else None,
                    "seccion": datos.seccion.strip() if datos.seccion else None,
                    "activo": datos.activo,
                    "id_ciclo_escolar": datos.id_ciclo_escolar,
                    "id_grado": datos.id_grado,
                    "id_seccion": datos.id_seccion,
                    "id_grado_seccion": datos.id_grado_seccion,
                }
            )

            return {
                "estado": "ok",
                "mensaje": "Información del estudiante actualizada correctamente.",
                "id_estudiante": id_estudiante
            }
    except HTTPException:
        raise
    except Exception as err:
        print(f"[Error en PUT /api/estudiantes/{id_estudiante}] {err}")
        raise HTTPException(status_code=500, detail="No se pudo actualizar la información del estudiante.")


@router.get("/api/estudiantes/{id_estudiante}/asistencias")
def obtener_asistencias_estudiante(
    id_estudiante: int,
    periodo: Literal["semana", "mes", "ciclo"] = Query("semana")
):
    """Obtiene el historial de asistencias de un estudiante para el período seleccionado (semana, mes o ciclo)."""
    try:
        with engine.connect() as conn:
            est = conn.execute(
                text("""
                    SELECT id_estudiante, uid_nfc, nombre, grado, seccion, id_establecimiento
                    FROM estudiante
                    WHERE id_estudiante = :id LIMIT 1
                """),
                {"id": id_estudiante}
            ).mappings().first()

            if not est:
                raise HTTPException(status_code=404, detail="Estudiante no encontrado.")

            # Construir consulta flexible y robusta vinculada al UID del estudiante
            sql = """
                SELECT id_registro, id_evento, uid_nfc, id_establecimiento,
                       fecha_hora, tipo_registro, recibido_en
                FROM asistencia_nfc
                WHERE TRIM(UPPER(uid_nfc)) = TRIM(UPPER(:uid))
            """
            params = {"uid": est["uid_nfc"]}

            # Aplicar filtro de fecha según el período seleccionado
            if periodo == "semana":
                sql += " AND fecha_hora >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)"
            elif periodo == "mes":
                sql += " AND fecha_hora >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)"
            # En "ciclo" muestra todo el historial histórico del estudiante sin cortar por días

            sql += " ORDER BY fecha_hora DESC"

            logs = conn.execute(text(sql), params).mappings().all()

            return {
                "estudiante": {
                    "id_estudiante": est["id_estudiante"],
                    "uid_nfc": est["uid_nfc"],
                    "nombre": est["nombre"],
                    "grado": est["grado"] or "",
                    "seccion": est["seccion"] or "",
                },
                "periodo": periodo,
                "total_registros": len(logs),
                "asistencias": [
                    {
                        "id_registro": l["id_registro"],
                        "tipo_registro": l["tipo_registro"],
                        "fecha_hora": _a_iso_utc(l["fecha_hora"]),
                    }
                    for l in logs
                ]
            }
    except HTTPException:
        raise
    except Exception as err:
        print(f"[Error en /api/estudiantes/{id_estudiante}/asistencias] {err}")
        raise HTTPException(status_code=500, detail="No se pudieron consultar las asistencias del estudiante.")


@router.get("/api/reporte_asistencia")
def reporte_asistencia(
    id_establecimiento: int = Query(1, gt=0),
    grado: Optional[str] = None,
    seccion: Optional[str] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
):
    """Primera entrada y última salida por estudiante y día (día local Guatemala, UTC-6)."""
    try:
        with engine.connect() as conn:
            sql = """
                SELECT e.nombre, e.uid_nfc, e.grado, e.seccion,
                       DATE(DATE_SUB(a.fecha_hora, INTERVAL 6 HOUR)) AS dia,
                       MIN(CASE WHEN a.tipo_registro = 'ENTRADA' THEN a.fecha_hora END) AS entrada,
                       MAX(CASE WHEN a.tipo_registro = 'SALIDA' THEN a.fecha_hora END) AS salida
                FROM estudiante e
                JOIN asistencia_nfc a ON TRIM(UPPER(a.uid_nfc)) = TRIM(UPPER(e.uid_nfc))
                WHERE e.id_establecimiento = :e
            """
            params = {"e": id_establecimiento}
            if grado and grado.strip():
                sql += " AND e.grado = :g"
                params["g"] = grado.strip()
            if seccion and seccion.strip():
                sql += " AND e.seccion = :s"
                params["s"] = seccion.strip()
            if desde:
                sql += " AND DATE(DATE_SUB(a.fecha_hora, INTERVAL 6 HOUR)) >= :d"
                params["d"] = desde
            if hasta:
                sql += " AND DATE(DATE_SUB(a.fecha_hora, INTERVAL 6 HOUR)) <= :h"
                params["h"] = hasta
            sql += " GROUP BY e.id_estudiante, e.nombre, e.uid_nfc, e.grado, e.seccion, dia"
            sql += " ORDER BY dia, e.grado, e.seccion, e.nombre"
            filas = conn.execute(text(sql), params).mappings().all()
            return [
                {
                    "nombre": f["nombre"],
                    "uid_nfc": f["uid_nfc"],
                    "grado": f["grado"] or "",
                    "seccion": f["seccion"] or "",
                    "dia": str(f["dia"]),
                    "entrada": _a_iso_utc(f["entrada"]) if f["entrada"] else "",
                    "salida": _a_iso_utc(f["salida"]) if f["salida"] else "",
                }
                for f in filas
            ]
    except Exception as err:
        print(f"[Error en /api/reporte_asistencia] {err}")
        raise HTTPException(status_code=500, detail="No se pudo generar el reporte.")


@router.get("/api/opciones_academicas")
def obtener_opciones_academicas(id_establecimiento: int = Query(1, gt=0)):
    """Devuelve los ciclos escolares, grados y secciones configurados."""
    try:
        with engine.connect() as conn:
            ciclos = conn.execute(
                text("SELECT id_ciclo_escolar, anio, nombre FROM ciclo_escolar WHERE id_establecimiento = :e ORDER BY anio DESC"),
                {"e": id_establecimiento}
            ).mappings().all()

            grados = conn.execute(
                text("SELECT id_grado, nombre FROM grado WHERE id_establecimiento = :e AND activo = 1 ORDER BY id_grado ASC"),
                {"e": id_establecimiento}
            ).mappings().all()

            secciones = conn.execute(
                text("SELECT id_seccion, nombre FROM seccion WHERE id_establecimiento = :e AND activo = 1 ORDER BY id_seccion ASC"),
                {"e": id_establecimiento}
            ).mappings().all()

            gs = conn.execute(
                text("""
                    SELECT gs.id_grado_seccion, gs.id_ciclo_escolar, gs.id_grado, gs.id_seccion,
                           g.nombre AS grado_nombre, s.nombre AS seccion_nombre
                    FROM grado_seccion gs
                    JOIN grado g ON g.id_grado = gs.id_grado
                    JOIN seccion s ON s.id_seccion = gs.id_seccion
                    JOIN ciclo_escolar c ON c.id_ciclo_escolar = gs.id_ciclo_escolar
                    WHERE c.id_establecimiento = :e
                """),
                {"e": id_establecimiento}
            ).mappings().all()

            return {
                "ciclos": [dict(c) for c in ciclos],
                "grados": [dict(g) for g in grados],
                "secciones": [dict(s) for s in secciones],
                "grados_secciones": [dict(x) for x in gs]
            }
    except Exception as err:
        print(f"[Error en /api/opciones_academicas] {err}")
        return {"ciclos": [], "grados": [], "secciones": [], "grados_secciones": []}
