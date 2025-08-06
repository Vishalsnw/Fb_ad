#!/usr/bin/env python3
import os
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
import requests
import logging
from urllib.parse import urlparse, parse_qs
import socketserver
import threading
import time
import hmac
import hashlib
import uuid

class AdGeneratorHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="public", **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/config.js' or parsed_path.path == '/api/config.js':
            self.serve_config()
        elif parsed_path.path == '/sitemap.xml':
            self.serve_sitemap()
        elif parsed_path.path == '/robots.txt':
            self.serve_robots()
        elif parsed_path.path.startswith('/api/'):
            self.handle_api_request()
        else:
            super().do_GET()

    def serve_sitemap(self):
        """Serve sitemap.xml"""
        try:
            with open('public/sitemap.xml', 'r') as f:
                sitemap_content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/xml')
            self.send_header('Cache-Control', 'max-age=86400')  # Cache for 1 day
            self.end_headers()
            self.wfile.write(sitemap_content.encode())
        except Exception as e:
            print(f"❌ Error serving sitemap: {e}")
            self.send_error(404, "Sitemap not found")

    def serve_robots(self):
        """Serve robots.txt"""
        try:
            with open('public/robots.txt', 'r') as f:
                robots_content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Cache-Control', 'max-age=86400')  # Cache for 1 day
            self.end_headers()
            self.wfile.write(robots_content.encode())
        except Exception as e:
            print(f"❌ Error serving robots.txt: {e}")
            self.send_error(404, "Robots.txt not found")

    def do_POST(self):
        """Handle POST requests"""
        path = urlparse(self.path).path

        if path == '/generate-ad':
            self.handle_ad_generation()
        elif path == '/api/create-razorpay-order':
            self.handle_create_razorpay_order()
        elif path == '/api/verify-payment':
            self.handle_verify_payment()
        else:
            self.send_error(404, "API endpoint not implemented")

    def serve_config(self):
        try:
            # Get API keys from environment
            deepseek_key = os.environ.get('DEEPSEEK_API_KEY', '')
            deepai_key = os.environ.get('DEEPAI_API_KEY', '')
            razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID', '')
            razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET', '')
            firebase_api_key = os.environ.get('FIREBASE_API_KEY', '')
            firebase_auth_domain = os.environ.get('FIREBASE_AUTH_DOMAIN', '')
            firebase_project_id = os.environ.get('FIREBASE_PROJECT_ID', '')
            firebase_app_id = os.environ.get('FIREBASE_APP_ID', '')

            # Check for missing keys
            missing_keys = []
            if not deepseek_key or len(deepseek_key.strip()) < 5:
                missing_keys.append('DEEPSEEK_API_KEY')
            if not deepai_key or len(deepai_key.strip()) < 5:
                missing_keys.append('DEEPAI_API_KEY')

            # Log key status
            print(f"🔑 DEEPSEEK_API_KEY: {'✅ Present' if deepseek_key else '❌ Missing'} ({len(deepseek_key)} chars)")
            print(f"🔑 DEEPAI_API_KEY: {'✅ Present' if deepai_key else '❌ Missing'} ({len(deepai_key)} chars)")
            print(f"🔑 RAZORPAY_KEY_ID: {'✅ Present' if razorpay_key_id else '❌ Missing'} ({len(razorpay_key_id)} chars)")
            print(f"🔑 RAZORPAY_KEY_SECRET: {'✅ Present' if razorpay_key_secret else '❌ Missing'} ({len(razorpay_key_secret)} chars)")
            print(f"🔑 FIREBASE_API_KEY: {'✅ Present' if firebase_api_key else '❌ Missing'} ({len(firebase_api_key)} chars)")
            print(f"🔑 FIREBASE_AUTH_DOMAIN: {'✅ Present' if firebase_auth_domain else '❌ Missing'} ({len(firebase_auth_domain)} chars)")
            print(f"🔑 FIREBASE_PROJECT_ID: {'✅ Present' if firebase_project_id else '❌ Missing'} ({len(firebase_project_id)} chars)")
            print(f"🔑 FIREBASE_APP_ID: {'✅ Present' if firebase_app_id else '❌ Missing'} ({len(firebase_app_id)} chars)")

            if missing_keys:
                print(f"❌ CRITICAL: Missing API keys: {', '.join(missing_keys)}")
                print("   - Go to Secrets tab in the left sidebar")
                print("   - Add DEEPSEEK_API_KEY with your DeepSeek API key")
                print("   - Add DEEPAI_API_KEY with your DeepAI API key")

            config_js = f'''
window.CONFIG = {{
    DEEPSEEK_API_KEY: '{deepseek_key}',
    DEEPAI_API_KEY: '{deepai_key}',
    RAZORPAY_KEY_ID: '{razorpay_key_id}',
    RAZORPAY_KEY_SECRET: '{razorpay_key_secret}',
    FIREBASE_API_KEY: '{firebase_api_key}',
    FIREBASE_AUTH_DOMAIN: '{firebase_auth_domain}',
    FIREBASE_PROJECT_ID: '{firebase_project_id}',
    FIREBASE_APP_ID: '{firebase_app_id}',
    SHOW_3D_EARLY: true,
    MISSING_KEYS: {str(missing_keys).replace("'", '"')}
}};
console.log('✅ Config loaded from server:', Object.keys(window.CONFIG));
if (window.CONFIG.MISSING_KEYS.length > 0) {{
    console.error('❌ Missing API keys:', window.CONFIG.MISSING_KEYS);
    console.log('🔧 Please add these keys in Replit Secrets and refresh the page');
}}
'''
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(config_js.encode())
        except Exception as e:
            print(f"❌ Error serving config: {e}")
            error_config = f'''
window.CONFIG = {{
    DEEPSEEK_API_KEY: '',
    DEEPAI_API_KEY: '',
    RAZORPAY_KEY_ID: '',
    RAZORPAY_KEY_SECRET: '',
    FIREBASE_API_KEY: '',
    FIREBASE_AUTH_DOMAIN: '',
    FIREBASE_PROJECT_ID: '',
    FIREBASE_APP_ID: '',
    SHOW_3D_EARLY: true,
    MISSING_KEYS: ["DEEPSEEK_API_KEY", "DEEPAI_API_KEY"]
}};
console.error('❌ Config loading failed');
'''
            self.send_response(500)
            self.send_header('Content-type', 'application/javascript')
            self.end_headers()
            self.wfile.write(error_config.encode())

    def handle_ad_generation(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            print(f"🚀 Received ad generation request: {data}")

            # Generate ad copy
            ad_copy = self.generate_ad_copy(data)
            if not ad_copy:
                raise Exception("Failed to generate ad copy")

            # Generate image
            image_url = self.generate_image(data)
            if not image_url:
                raise Exception("Failed to generate image")

            response = {
                'success': True,
                'ad_copy': ad_copy,
                'image_url': image_url
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())

        except Exception as e:
            print(f"❌ Error in ad generation: {e}")
            traceback.print_exc()

            error_response = {
                'success': False,
                'error': str(e)
            }

            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode())

    def generate_ad_copy(self, data):
        try:
            deepseek_key = os.environ.get('DEEPSEEK_API_KEY')
            if not deepseek_key:
                raise Exception("DEEPSEEK_API_KEY not configured")

            language = data.get('language', 'English')
            product_name = data.get('productName', '')
            product_description = data.get('productDescription', '')
            target_audience = data.get('targetAudience', '')
            special_offer = data.get('specialOffer', '')
            tone = data.get('tone', 'professional')

            prompt = f"""Create a compelling Facebook ad copy in {language} for:
Product: {product_name}
Description: {product_description}
Target Audience: {target_audience}
Special Offer: {special_offer}
Tone: {tone}

Create engaging ad copy that includes:
1. An attention-grabbing headline
2. Clear benefits and value proposition
3. Call to action
4. Keep it concise and persuasive

Write in {language} language only."""

            headers = {
                'Authorization': f'Bearer {deepseek_key}',
                'Content-Type': 'application/json'
            }

            payload = {
                'model': 'deepseek-chat',
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 300,
                'temperature': 0.7
            }

            response = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers=headers,
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                return result['choices'][0]['message']['content'].strip()
            else:
                print(f"❌ DeepSeek API error: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"❌ Error generating ad copy: {e}")
            return None

    def generate_image(self, data):
        try:
            deepai_key = os.environ.get('DEEPAI_API_KEY')
            if not deepai_key:
                raise Exception("DEEPAI_API_KEY not configured")

            product_name = data.get('productName', '')
            product_description = data.get('productDescription', '')

            prompt = f"Professional advertisement image for {product_name}: {product_description}, high quality, modern design, marketing photo"

            response = requests.post(
                'https://api.deepai.org/api/text2img',
                data={'text': prompt},
                headers={'api-key': deepai_key},
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                return result.get('output_url')
            else:
                print(f"❌ DeepAI API error: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"❌ Error generating image: {e}")
            return None

    def handle_api_request(self):
        self.send_error(404, "API endpoint not implemented")

    def send_json(self, data, status=200):
        """Send a JSON response"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def handle_create_razorpay_order(self):
        """Handle Razorpay order creation"""
        try:
            # Get request data
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            print(f"📡 Creating Razorpay order: {data}")

            # Validate required fields
            required_fields = ['amount', 'planKey']
            missing_fields = [field for field in required_fields if not data.get(field)]

            if missing_fields:
                self.send_json({
                    'success': False,
                    'error': f'Missing required fields: {", ".join(missing_fields)}'
                }, status=400)
                return

            # Get Razorpay keys
            razorpay_key_id = os.getenv('RAZORPAY_KEY_ID')
            razorpay_key_secret = os.getenv('RAZORPAY_KEY_SECRET')

            if not razorpay_key_id or not razorpay_key_secret:
                print("❌ Razorpay keys not found in environment")
                self.send_json({
                    'success': False,
                    'error': 'Payment system configuration error'
                }, status=500)
                return

            # Create order using Razorpay API
            import base64
            auth_str = f"{razorpay_key_id}:{razorpay_key_secret}"
            auth_bytes = auth_str.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

            # Generate a short receipt ID (max 40 chars)
            receipt_id = f"rcpt_{str(uuid.uuid4())[:8]}_{int(time.time()) % 100000}"
            
            order_data = {
                'amount': int(data['amount']),
                'currency': data.get('currency', 'INR'),
                'receipt': receipt_id,
                'notes': {
                    'planKey': data['planKey'],
                    'userId': data.get('userId', '')
                }
            }

            response = requests.post(
                'https://api.razorpay.com/v1/orders',
                json=order_data,
                headers={
                    'Authorization': f'Basic {auth_b64}',
                    'Content-Type': 'application/json'
                },
                timeout=30
            )

            if response.status_code == 200:
                order = response.json()
                print(f"✅ Razorpay order created: {order['id']}")

                self.send_json({
                    'success': True,
                    'orderId': order['id'],
                    'amount': order['amount'],
                    'currency': order['currency'],
                    'planKey': data['planKey']
                })
            else:
                print(f"❌ Razorpay API error: {response.status_code} - {response.text}")
                self.send_json({
                    'success': False,
                    'error': 'Failed to create order',
                    'details': response.text
                }, status=500)

        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error: {e}")
            self.send_json({
                'success': False,
                'error': 'Invalid JSON in request'
            }, status=400)
        except Exception as e:
            print(f"❌ Order creation error: {e}")
            self.send_json({
                'success': False,
                'error': 'Failed to create order',
                'details': str(e)
            }, status=500)

    def handle_verify_payment(self):
        """Handle payment verification"""
        try:
            # Get request data
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            print(f"📡 Verifying payment: {data}")

            # Validate required fields
            required_fields = ['razorpay_payment_id', 'razorpay_order_id', 'razorpay_signature']
            missing_fields = [field for field in required_fields if not data.get(field)]

            if missing_fields:
                self.send_json({
                    'success': False,
                    'error': f'Missing required payment details: {", ".join(missing_fields)}'
                }, status=400)
                return

            # Get Razorpay secret
            razorpay_key_secret = os.getenv('RAZORPAY_KEY_SECRET')

            if not razorpay_key_secret:
                print("❌ Razorpay secret not found in environment")
                self.send_json({
                    'success': False,
                    'error': 'Payment verification configuration error'
                }, status=500)
                return

            # Verify signature
            body = f"{data['razorpay_order_id']}|{data['razorpay_payment_id']}"
            expected_signature = hmac.new(
                razorpay_key_secret.encode('utf-8'),
                body.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

            is_authentic = hmac.compare_digest(expected_signature, data['razorpay_signature'])

            if not is_authentic:
                print("❌ Payment signature verification failed")
                self.send_json({
                    'success': False,
                    'error': 'Payment verification failed - invalid signature'
                }, status=400)
                return

            print("✅ Payment signature verified successfully")

            # Payment verified successfully
            self.send_json({
                'success': True,
                'message': 'Payment verified successfully',
                'planKey': data.get('planKey', 'pro'),
                'payment_id': data['razorpay_payment_id'],
                'order_id': data['razorpay_order_id']
            })

        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error in payment verification: {e}")
            self.send_json({
                'success': False,
                'error': 'Invalid JSON in request'
            }, status=400)
        except Exception as e:
            print(f"❌ Payment verification error: {e}")
            self.send_json({
                'success': False,
                'error': 'Payment verification failed',
                'details': str(e)
            }, status=500)

def run_server():
    port = int(os.getenv('PORT', 5000))
    server_address = ('0.0.0.0', port)

    print(f"🚀 Starting server on port {port}...")

    httpd = HTTPServer(server_address, AdGeneratorHandler)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        httpd.server_close()

if __name__ == '__main__':
    run_server()