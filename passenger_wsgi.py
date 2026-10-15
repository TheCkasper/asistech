import os
import sys

# Asegurar que el directorio raíz del proyecto esté en el path de Python
sys.path.insert(0, os.path.dirname(__file__))

try:
    from a2wsgi import ASGIMiddleware
    from main import app

    # Passenger (cPanel) requiere la variable 'application' compatible con WSGI
    application = ASGIMiddleware(app)

except Exception as e:
    import traceback
    error_detalle = traceback.format_exc()

    # En caso de error de arranque, muestra el traceback de Python directamente en el navegador
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
