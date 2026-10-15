import os
import sys

# Asegurar que el directorio raíz del proyecto esté en el path de Python
sys.path.insert(0, os.path.dirname(__file__))

from a2wsgi import ASGIMiddleware
from main import app

# Passenger (cPanel) requiere la variable 'application' compatible con WSGI
application = ASGIMiddleware(app)
