import os
import sys
import traceback

# Directorio raíz del proyecto
PROJECT_ROOT = os.path.dirname(__file__)
sys.path.insert(0, PROJECT_ROOT)

# Inclusión del entorno virtual de cPanel (~/virtualenv/...)
VENV_BASE = os.path.expanduser('~/virtualenv/' + os.path.basename(PROJECT_ROOT))
if os.path.exists(VENV_BASE):
    for root, dirs, files in os.walk(VENV_BASE):
        if root.endswith('site-packages'):
            if root not in sys.path:
                sys.path.insert(0, root)

try:
    from a2wsgi import ASGIMiddleware
    from main import app

    raw_application = ASGIMiddleware(app)

    # Captura errores que ocurran al procesar la petición web HTTP
    def application(environ, start_response):
        try:
            return raw_application(environ, start_response)
        except Exception as e:
            error_msg = traceback.format_exc()
            status = '200 OK'
            html = f"""
            <!DOCTYPE html>
            <html>
            <head><title>Error HTTP - ASISTECH</title></head>
            <body style="font-family: monospace; padding: 20px; background: #121212; color: #ff5252;">
                <h1>⚠️ Error al procesar la petición HTTP</h1>
                <pre style="background: #1e1e1e; padding: 15px; color: #e0e0e0; white-space: pre-wrap;">{error_msg}</pre>
            </body>
            </html>
            """
            output = html.encode('utf-8')
            response_headers = [('Content-Type', 'text/html; charset=utf-8'),
                                ('Content-Length', str(len(output)))]
            start_response(status, response_headers)
            return [output]

except Exception as e:
    startup_error = traceback.format_exc()

    # Captura errores que ocurran al importar los módulos al inicio
    def application(environ, start_response):
        status = '200 OK'
        html = f"""
        <!DOCTYPE html>
        <html>
        <head><title>Error de Inicio - ASISTECH</title></head>
        <body style="font-family: monospace; padding: 20px; background: #121212; color: #ff5252;">
            <h1>⚠️ Error de importación al iniciar la app</h1>
            <pre style="background: #1e1e1e; padding: 15px; color: #e0e0e0; white-space: pre-wrap;">{startup_error}</pre>
        </body>
        </html>
        """
        output = html.encode('utf-8')
        response_headers = [('Content-Type', 'text/html; charset=utf-8'),
                            ('Content-Length', str(len(output)))]
        start_response(status, response_headers)
        return [output]
