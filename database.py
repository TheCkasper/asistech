import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

load_dotenv(Path(__file__).resolve().parent / ".env")

url = URL.create(
    drivername="mysql+pymysql",
    username=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    host=os.environ["DB_HOST"],
    port=int(os.environ["DB_PORT"]),
    database=os.environ["DB_NAME"],
    query={"charset": "utf8mb4"},
)

engine = create_engine(
    url,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5},
)


if __name__ == "__main__":
    try:
        with engine.connect() as conexion:
            conexion.execute(text("SELECT 1"))

        print("Conexión exitosa con la base de datos ASISTECH.")

    except SQLAlchemyError:
        print(
            "No se pudo conectar. Revisa los datos del archivo .env "
            "y que el contenedor de MariaDB esté encendido."
        )