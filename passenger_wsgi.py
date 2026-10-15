import os
import sys

# Asegurar path del proyecto
PROJECT_ROOT = os.path.dirname(__file__)
sys.path.insert(0, PROJECT_ROOT)

# Detección de site-packages de virtualenv
VENV_BASE = os.path.expanduser('~/virtualenv/' + os.path.basename(PROJECT_ROOT))
if os.path.exists(VENV_BASE):
    for root, dirs, files in os.walk(VENV_BASE):
        if root.endswith('site-packages'):
            if root not in sys.path:
                sys.path.insert(0, root)

pasos = []

# Prueba 1: a2wsgi
try:
    from a2wsgi import ASGIMiddleware
    pasos.append("✅ a2wsgi importado correctamente")
except Exception as e:
    pasos.append(f"❌ Error importando a2wsgi: {e}")

# Prueba 2: database
try:
    import database
    pasos.append("✅ database.py importado correctamente")
except Exception as e:
    pasos.append(f"❌ Error importando database.py: {e}")

# Prueba 3: main.py
try:
    from main import app
    pasos.append("✅ main.py importado correctamente")
    application = ASGIMiddleware(app)
    pasos.append("✅ ASGIMiddleware(app) creado con éxito!")
except Exception as e:
    import traceback
    pasos.append(f"❌ Error en main.py:\n{traceback.format_exc()}")

    # Si falló la creación de la app, definir handler de diagnóstico
    def application(environ, start_response):
        status = '200 OK'
        reporte = "\n\n".join(pasos)
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Diagnóstico ASISTECH</title>
            <style>
                body {{ font-family: monospace; padding: 20px; background: #121212; color: #e0e0e0; }}
                h1 {{ color: #4fc3f7; }}
                pre {{ background: #1e1e1e; padding: 15px; border-radius: 8px; border: 1px solid #333; overflow-x: auto; white-space: pre-wrap; }}
            </style>
        </head>
        <body>
            <h1>🔍 Diagnóstico de Módulos ASISTECH</h1>
            <pre>{reporte}</pre>
        </body>
        </html>
        """
        output = html.encode('utf-8')
        response_headers = [('Content-Type', 'text/html; charset=utf-8'),
                            ('Content-Length', str(len(output)))]
        start_response(status, response_headers)
        return [output]
