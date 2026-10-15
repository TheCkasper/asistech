import os
import sys

# Directorio raíz del proyecto
PROJECT_ROOT = os.path.dirname(__file__)
sys.path.insert(0, PROJECT_ROOT)

# Detección automática del entorno virtual de cPanel (~/virtualenv/...)
VENV_BASE = os.path.expanduser('~/virtualenv/' + os.path.basename(PROJECT_ROOT))
if os.path.exists(VENV_BASE):
    for root, dirs, files in os.walk(VENV_BASE):
        if root.endswith('site-packages'):
            if root not in sys.path:
                sys.path.insert(0, root)

try:
    from a2wsgi import ASGIMiddleware
    from main import app

    # Passenger (cPanel) requiere la variable 'application' compatible con WSGI
    application = ASGIMiddleware(app)

except Exception as e:
    import traceback
    error_detalle = traceback.format_exc()

    def application(environ, start_response):
        status = '500 Internal Server Error'
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Error de Inicio - ASISTECH</title>
            <style>
                body {{ font-family: monospace; padding: 20px; background: #1e1e1e; color: #f48fb1; }}
                h1 {{ color: #ff5252; }}
                pre {{ background: #2d2d2d; padding: 15px; border-radius: 8px; color: #e0e0e0; overflow-x: auto; }}
            </style>
        </head>
        <body>
            <h1>⚠️ Error en el inicio de la aplicación Python</h1>
            <p>Se produjo la siguiente excepción al intentar cargar el proyecto:</p>
            <pre>{error_detalle}</pre>
        </body>
        </html>
        """
        output = html.encode('utf-8')
        response_headers = [
            ('Content-Type', 'text/html; charset=utf-8'),
            ('Content-Length', str(len(output)))
        ]
        start_response(status, response_headers)
        return [output]
