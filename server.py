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
        'DEEPAI_API_KEY': os.getenv('DEEPAI_API_KEY', ''),
        'RAZORPAY_KEY_ID': os.getenv('RAZORPAY_KEY_ID', ''),
        'RAZORPAY_KEY_SECRET': os.getenv('RAZORPAY_KEY_SECRET', '')
    }
    return env_vars

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

    def do_GET(self):
        if self.path.startswith('/config.js'):
            # Serve the config with environment variables
            env_vars = load_env()
            deepseek_key = env_vars.get('DEEPSEEK_API_KEY', '')
            deepai_key = env_vars.get('DEEPAI_API_KEY', '')
            razorpay_key_id = env_vars.get('RAZORPAY_KEY_ID', '')
            razorpay_key_secret = env_vars.get('RAZORPAY_KEY_SECRET', '')

            # Debug: Print key status (without exposing actual keys)
            print(f"DEEPSEEK_API_KEY loaded: {'Yes' if deepseek_key else 'No'}")
            print(f"DEEPAI_API_KEY loaded: {'Yes' if deepai_key else 'No'}")
            print(f"RAZORPAY_KEY_ID loaded: {'Yes' if razorpay_key_id else 'No'}")
            print(f"RAZORPAY_KEY_SECRET loaded: {'Yes' if razorpay_key_secret else 'No'}")

            # Check if keys are actually available
            if not deepseek_key:
                print("WARNING: DEEPSEEK_API_KEY is empty or not set in Replit Secrets")
            if not deepai_key:
                print("WARNING: DEEPAI_API_KEY is empty or not set in Replit Secrets")
            if not razorpay_key_id:
                print("WARNING: RAZORPAY_KEY_ID is empty or not set in Replit Secrets")
            if not razorpay_key_secret:
                print("WARNING: RAZORPAY_KEY_SECRET is empty or not set in Replit Secrets")

            config_content = f"""
window.CONFIG = {{
    DEEPSEEK_API_KEY: '{deepseek_key}',
    DEEPAI_API_KEY: '{deepai_key}',
    RAZORPAY_KEY_ID: '{razorpay_key_id}',
    RAZORPAY_KEY_SECRET: '{razorpay_key_secret}'
}};
"""
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.send_header('Cache-Control', 'no-cache')
            self.end_headers()
            self.wfile.write(config_content.encode())
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/create-razorpay-order':
            self.handle_razorpay_order()
        elif self.path == '/verify-payment':
            self.handle_payment_verification()
        elif self.path == '/sync-user-data':
            self.handle_user_data_sync()
        elif self.path == '/save-ad':
            self.handle_save_ad()
        else:
            self.send_response(404)
            self.end_headers()

    def handle_razorpay_order(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            plan_key = data.get('planKey')
            plan_name = data.get('planName')
            price = data.get('price')

            # In a real implementation, you would use Razorpay's API here
            # For demo purposes, we'll return a mock order
            import time
            order_id = f"order_{plan_key}_{int(time.time())}"

            response = {
                'order_id': order_id,
                'amount': price,
                'currency': 'INR'
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f"Error in create-razorpay-order: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {
                'error': str(e),
                'message': 'Failed to create payment order. Please try again.'
            }
            self.wfile.write(json.dumps(error_response).encode())

    def handle_payment_verification(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # In a real implementation, you would verify the payment signature here
            # using Razorpay's webhook signature verification
            # For demo purposes, we'll return success

            response = {'success': True}

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f"Error in verify-payment: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {
                'error': str(e),
                'success': False,
                'message': 'Payment verification failed. Please contact support.'
            }
            self.wfile.write(json.dumps(error_response).encode())

    def handle_user_data_sync(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            user_id = data.get('id')

            # In a real implementation, you would save to a database
            # For demo purposes, we'll just return the data with server-side info

            # Load existing user data (in real app, from database)
            user_data_file = f"user_data_{user_id}.json"
            existing_data = {}

            try:
                if os.path.exists(user_data_file):
                    with open(user_data_file, 'r') as f:
                        existing_data = json.load(f)
            except Exception:
                pass

            # Merge with new data
            merged_data = {**existing_data, **data}

            # Save updated data
            try:
                with open(user_data_file, 'w') as f:
                    json.dump(merged_data, f)
            except Exception as e:
                print(f"Error saving user data: {e}")

            response = {
                'success': True,
                'userData': merged_data
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f"Error in sync-user-data: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {
                'error': str(e),
                'success': False
            }
            self.wfile.write(json.dumps(error_response).encode())

    def handle_save_ad(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            user_id = data.get('userId')
            ad_id = data.get('id')

            # Save ad data (in real app, to database)
            ads_data_file = f"user_ads_{user_id}.json"
            existing_ads = []

            try:
                if os.path.exists(ads_data_file):
                    with open(ads_data_file, 'r') as f:
                        existing_ads = json.load(f)
            except Exception:
                pass

            # Add new ad
            existing_ads.insert(0, data)

            # Keep only last 100 ads
            existing_ads = existing_ads[:100]

            # Save updated ads
            try:
                with open(ads_data_file, 'w') as f:
                    json.dump(existing_ads, f)
            except Exception as e:
                print(f"Error saving ad data: {e}")

            response = {'success': True, 'adId': ad_id}

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f"Error in save-ad: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = {
                'error': str(e),
                'success': False
            }
            self.wfile.write(json.dumps(error_response).encode())

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

try:
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Server starting on http://0.0.0.0:{PORT}")

        # Print API key status on startup
        env_vars = load_env()
        print("\n=== API KEYS STATUS ===")
        print(f"DEEPSEEK_API_KEY: {'✓ Loaded' if env_vars.get('DEEPSEEK_API_KEY') else '✗ Missing'}")
        print(f"DEEPAI_API_KEY: {'✓ Loaded' if env_vars.get('DEEPAI_API_KEY') else '✗ Missing'}")
        print(f"RAZORPAY_KEY_ID: {'✓ Loaded' if env_vars.get('RAZORPAY_KEY_ID') else '✗ Missing'}")
        print(f"RAZORPAY_KEY_SECRET: {'✓ Loaded' if env_vars.get('RAZORPAY_KEY_SECRET') else '✗ Missing'}")
        

        missing_keys = []
        if not env_vars.get('DEEPSEEK_API_KEY'):
            missing_keys.append('DEEPSEEK_API_KEY')
        if not env_vars.get('DEEPAI_API_KEY'):
            missing_keys.append('DEEPAI_API_KEY')
        if not env_vars.get('RAZORPAY_KEY_ID'):
            missing_keys.append('RAZORPAY_KEY_ID')
        if not env_vars.get('RAZORPAY_KEY_SECRET'):
            missing_keys.append('RAZORPAY_KEY_SECRET')
        

        if missing_keys:
            print(f"\n⚠️  WARNING: Missing keys: {', '.join(missing_keys)}")
            print("Please add them in Replit Secrets:")
            print("1. Go to Tools → Secrets")
            print("2. Add DEEPSEEK_API_KEY with your DeepSeek API key")
            print("3. Add DEEPAI_API_KEY with your DeepAI API key")
            print("4. Add RAZORPAY_KEY_ID with your Razorpay Key ID")
            print("5. Add RAZORPAY_KEY_SECRET with your Razorpay Key Secret")
        else:
            print("\n✅ All API keys loaded successfully!")

        print("======================\n")
        print("Payment endpoints available:")
        print("  POST /create-razorpay-order - Create Razorpay order")
        print("  POST /verify-payment - Verify Razorpay payment")
        print("  POST /sync-user-data - Sync user data")
        print("  POST /save-ad - Save ad")
        httpd.serve_forever()
except Exception as e:
    print(f"ERROR starting server: {e}")
    sys.exit(1)