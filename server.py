
import http.server
import socketserver
import os
from urllib.parse import urlparse
import json

# Load environment variables from Replit Secrets
def load_env():
    env_vars = {
        'DEEPSEEK_API_KEY': os.getenv('DEEPSEEK_API_KEY', ''),
        'DEEPAI_API_KEY': os.getenv('DEEPAI_API_KEY', '')
    }
    return env_vars

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/config.js':
            # Serve the config with environment variables
            env_vars = load_env()
            deepseek_key = env_vars.get('DEEPSEEK_API_KEY', '')
            deepai_key = env_vars.get('DEEPAI_API_KEY', '')
            
            # Debug: Print key status (without exposing actual keys)
            print(f"DEEPSEEK_API_KEY loaded: {'Yes' if deepseek_key else 'No'}")
            print(f"DEEPAI_API_KEY loaded: {'Yes' if deepai_key else 'No'}")
            
            config_content = f"""
window.CONFIG = {{
    DEEPSEEK_API_KEY: '{deepseek_key}',
    DEEPAI_API_KEY: '{deepai_key}'
}};
"""
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(config_content.encode())
        else:
            super().do_GET()

PORT = 5000
Handler = CustomHTTPRequestHandler

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
