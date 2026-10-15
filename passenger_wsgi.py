
import os
import sys
import threading

# Directorio raíz del proyecto
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from a2wsgi import ASGIMiddleware
from main import app

# Inicialización del adaptador dentro del proceso de Passenger
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
