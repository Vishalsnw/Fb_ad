import http.server
import socketserver
import os
from urllib.parse import urlparse
import json
import sys

# Load environment variables from Replit Secrets
def load_env():
    env_vars = {
        'DEEPSEEK_API_KEY': os.getenv('DEEPSEEK_API_KEY', ''),
        'DEEPAI_API_KEY': os.getenv('DEEPAI_API_KEY', '')
    }
    return env_vars

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)

    def do_GET(self):
        if self.path.startswith('/config.js'):
            # Serve the config with environment variables
            env_vars = load_env()
            deepseek_key = env_vars.get('DEEPSEEK_API_KEY', '')
            deepai_key = env_vars.get('DEEPAI_API_KEY', '')

            # Debug: Print key status (without exposing actual keys)
            print(f"DEEPSEEK_API_KEY loaded: {'Yes' if deepseek_key else 'No'}")
            print(f"DEEPAI_API_KEY loaded: {'Yes' if deepai_key else 'No'}")

            # Check if keys are actually available
            if not deepseek_key:
                print("WARNING: DEEPSEEK_API_KEY is empty or not set in Replit Secrets")
            if not deepai_key:
                print("WARNING: DEEPAI_API_KEY is empty or not set in Replit Secrets")

            config_content = f"""
window.CONFIG = {{
    DEEPSEEK_API_KEY: '{deepseek_key}',
    DEEPAI_API_KEY: '{deepai_key}'
}};
"""
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(config_content.encode())
        else:
            super().do_GET()

def find_free_port(start_port=5000):
    """Find a free port starting from start_port"""
    import socket
    for port in range(start_port, start_port + 100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("0.0.0.0", port))
                return port
        except OSError:
            continue
    return None

# Try to find a free port
PORT = find_free_port(5000)
if PORT is None:
    print("ERROR: Could not find a free port")
    sys.exit(1)

Handler = CustomHTTPRequestHandler

import http.server
import socketserver
import os
import json
import urllib.parse
from urllib.parse import urlparse, parse_qs

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        if self.path == '/create-checkout-session':
            self.handle_checkout_session()
        else:
            super().do_POST()

    def handle_checkout_session(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # In a real implementation, you would use Stripe's API here
            # For demo purposes, we'll return a mock session

            plan_key = data.get('planKey')
            plan_name = data.get('planName')
            price = data.get('price')

            # Mock Stripe session response
            response = {
                'id': f'cs_test_{plan_key}_session',
                'url': f'https://checkout.stripe.com/pay/cs_test_{plan_key}_session#fidkdWxOYHwnPyd1blpxYHZxWjA0TUNATHZGNlRdPFJTVkBmQEhiU3Y9MVB8QU1gfXw1S19VcFNqVjI2TTVuNVZEMmxHZkdiQWAyXXE8aT1QRnw9cjJSbDA9TnFKYCcpJ2N3amhWYHdzYHcnP3F3cGApJ2lkfGpwcVF8dWAnPyd2bGtiaWBabHFgaCcpJ2BrZGdpYFVpZGZgbWppYWB3dic%2FcXdwYHgl'
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode())

try:
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Server starting on http://0.0.0.0:{PORT}")

        # Print API key status on startup
        env_vars = load_env()
        print("\n=== API KEYS STATUS ===")
        print(f"DEEPSEEK_API_KEY: {'✓ Loaded' if env_vars.get('DEEPSEEK_API_KEY') else '✗ Missing'}")
        print(f"DEEPAI_API_KEY: {'✓ Loaded' if env_vars.get('DEEPAI_API_KEY') else '✗ Missing'}")

        if not env_vars.get('DEEPSEEK_API_KEY') or not env_vars.get('DEEPAI_API_KEY'):
            print("\n⚠️  WARNING: Some API keys are missing!")
            print("Please add them in Replit Secrets:")
            print("1. Go to Tools → Secrets")
            print("2. Add DEEPSEEK_API_KEY with your DeepSeek API key")
            print("3. Add DEEPAI_API_KEY with your DeepAI API key")
        else:
            print("\n✅ All API keys loaded successfully!")

        print("======================\n")
        print("Payment endpoints available:")
        print("  POST /create-checkout-session - Create Stripe checkout session")
        httpd.serve_forever()
except Exception as e:
    print(f"ERROR starting server: {e}")
    sys.exit(1)