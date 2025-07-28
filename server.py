#!/usr/bin/env python3
import os
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import traceback
import time
from datetime import datetime
import requests

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
        self.end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/config.js':
            self.serve_config()
        elif parsed_path.path.startswith('/api/'):
            self.handle_api_request()
        else:
            super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/generate-ad':
            self.handle_ad_generation()
        elif parsed_path.path.startswith('/api/'):
            self.handle_api_request()
        else:
            self.send_error(404, "Not Found")

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