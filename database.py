import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

load_dotenv(Path(__file__).resolve().parent / ".env")

url = URL.create(
    drivername="mysql+pymysql",
    username=os.getenv("DB_USER", "root"),
    password=os.getenv("DB_PASSWORD", "root"),
    host=os.getenv("DB_HOST", "127.0.0.1"),
    port=int(os.getenv("DB_PORT", "3306")),
    database=os.getenv("DB_NAME", "asistech"),
    query={"charset": "utf8mb4"},
)

engine = create_engine(
    url,
    pool_pre_ping=True,
    connect_args={
        "connect_timeout": 3,
        "read_timeout": 3,
    },
)


if __name__ == "__main__":
    try:
        with engine.connect() as conexion:
            conexion.execute(text("SELECT 1"))

        print("Conexión exitosa con la base de datos ASISTECH.")

    except SQLAlchemyError as err:
        print(
            f"No se pudo conectar: {err}. Revisa los datos del archivo .env "
            "y que el contenedor o servicio de MariaDB/MySQL esté encendido."
        )