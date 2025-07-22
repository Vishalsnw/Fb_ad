
import http.server
import socketserver
import os
from urllib.parse import urlparse
import json

# Load environment variables from .env file
def load_env():
    env_vars = {}
    if os.path.exists('.env'):
        with open('.env', 'r') as f:
            for line in f:
                if line.strip() and not line.startswith('#'):
                    key, value = line.strip().split('=', 1)
                    env_vars[key] = value
    return env_vars

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/config.js':
            # Serve the config with environment variables
            env_vars = load_env()
            config_content = f"""
window.CONFIG = {{
    DEEPSEEK_API_KEY: '{env_vars.get('DEEPSEEK_API_KEY', '')}',
    DEEPAI_API_KEY: '{env_vars.get('DEEPAI_API_KEY', '')}'
}};
"""
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.end_headers()
            self.wfile.write(config_content.encode())
        else:
            super().do_GET()

PORT = 5000
Handler = CustomHTTPRequestHandler

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
