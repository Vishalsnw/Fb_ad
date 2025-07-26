#!/usr/bin/env python3
import os
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import traceback

class AdGeneratorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='public', **kwargs)

    def do_GET(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/config.js':
            self.serve_config()
        elif parsed_path.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "healthy"}).encode())
        else:
            super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/save-ad':
            self.handle_save_ad()
        elif parsed_path.path == '/sync-user-data':
            self.handle_sync_user_data()
        elif parsed_path.path == '/verify-payment':
            self.handle_verify_payment()
        elif parsed_path.path == '/create-razorpay-order':
            self.handle_create_razorpay_order()
        else:
            self.send_error(404, "Not Found")

    def serve_config(self):
        """Serve configuration with environment variables"""
        try:
            # Debug: Log environment variables (without exposing full keys)
            deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
            deepai_key = os.getenv("DEEPAI_API_KEY", "")

            print(f"🔑 DEEPSEEK_API_KEY: {'✅ Present' if deepseek_key else '❌ Missing'} ({len(deepseek_key)} chars)")
            print(f"🔑 DEEPAI_API_KEY: {'✅ Present' if deepai_key else '❌ Missing'} ({len(deepai_key)} chars)")

            if not deepseek_key or not deepai_key:
                print("❌ CRITICAL: Missing API keys! Please add them in Replit Secrets.")

            config_js = f'''
window.CONFIG = {{
    DEEPSEEK_API_KEY: '{deepseek_key}',
    DEEPAI_API_KEY: '{deepai_key}',
    GOOGLE_CLIENT_ID: '{os.getenv("GOOGLE_CLIENT_ID", "")}',
    RAZORPAY_KEY_ID: '{os.getenv("RAZORPAY_KEY_ID", "")}',
    RAZORPAY_KEY_SECRET: '{os.getenv("RAZORPAY_KEY_SECRET", "")}',
    SHOW_3D_EARLY: true
}};
'''
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(config_js.encode())
        except Exception as e:
            print(f"Error serving config: {e}")
            self.send_error(500, "Internal Server Error")

    def handle_save_ad(self):
        """Handle saving ad data"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            ad_data = json.loads(post_data.decode('utf-8'))

            # Save to file (in production, use a proper database)
            user_id = ad_data.get('userId', 'anonymous')
            filename = f'public/user_ads_{user_id}.json'

            try:
                with open(filename, 'r') as f:
                    ads = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError):
                ads = []

            ads.insert(0, ad_data)
            ads = ads[:4]  # Limit to 4 ads (Ad limit set to 4)

            with open(filename, 'w') as f:
                json.dump(ads, f, indent=2)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())

        except Exception as e:
            print(f"Error saving ad: {e}")
            self.send_error(500, "Internal Server Error")

    def handle_sync_user_data(self):
        """Handle user data synchronization"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            user_data = json.loads(post_data.decode('utf-8'))

            # In production, sync with database
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(user_data).encode())

        except Exception as e:
            print(f"Error syncing user data: {e}")
            self.send_error(500, "Internal Server Error")

    def handle_verify_payment(self):
        """Handle payment verification and JSON parsing errors."""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            try:
                payment_data = json.loads(post_data.decode('utf-8'))
                # In a real application, you would verify the payment with Razorpay or another provider.
                # This is a simplified example.
                print("Payment data received and parsed:", payment_data)
                response_data = {"success": True, "message": "Payment verified (mock)"}
            except json.JSONDecodeError as e:
                print(f"JSONDecodeError: {e}")
                print(f"Raw data received: {post_data.decode('utf-8')}")
                response_data = {"success": False, "error": "Invalid JSON format"}

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())

        except Exception as e:
            print(f"Payment verification error: {e}")
            self.send_error(500, "Internal Server Error")

    def handle_create_razorpay_order(self):
        """Handle Razorpay order creation"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            order_data = json.loads(post_data.decode('utf-8'))

            print(f"Creating order for: {order_data}")

            # Mock order creation - return a fake order ID
            import uuid
            order_id = f"order_{uuid.uuid4().hex[:12]}"

            response_data = {
                "success": True,
                "order_id": order_id,
                "amount": order_data.get('price', 59900),
                "currency": order_data.get('currency', 'INR')
            }

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())

        except Exception as e:
            print(f"Order creation error: {e}")
            error_response = {
                "success": False,
                "error": "Failed to create order",
                "details": str(e)
            }

            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode())

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def run_server():
    port = int(os.getenv('PORT', 5000))
    server_address = ('0.0.0.0', port)

    httpd = HTTPServer(server_address, AdGeneratorHandler)
    print(f"🚀 Server running on http://0.0.0.0:{port}")
    print(f"📱 Access your app at: http://localhost:{port}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.server_close()

if __name__ == '__main__':
    run_server()