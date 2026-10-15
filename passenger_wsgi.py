import os
import sys

# Directorio raíz del proyecto
PROJECT_ROOT = os.path.dirname(__file__)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from a2wsgi import ASGIMiddleware
from main import app

# Passenger (cPanel) requiere la variable 'application' compatible con WSGI
application = ASGIMiddleware(app)
