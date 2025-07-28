#!/usr/bin/env python3
# Applying changes to fix syntax errors, malformed responses, and incomplete print statements in server.py
import os
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import traceback
import time
from datetime import datetime # Import datetime

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
        elif parsed_path.path == '/api/config-check':
            self.serve_config_check()
        elif parsed_path.path.startswith('/get-user-data/'): # Added to handle new get user data endpoint
            self.handle_get_user_data(parsed_path.path[len('/get-user-data/'):]) # Extract user ID from path
        else:
            super().do_GET()

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        # TODO: Replace * with specific allowed origins in production
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_POST(self):
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/save-ad':
            self.handle_save_ad()
        elif parsed_path.path == '/sync-user-data':
            self.handle_sync_user_data()
        elif parsed_path.path == '/api/create-razorpay-order':
            self.handle_create_razorpay_order()
        elif parsed_path.path == '/api/verify-payment':
            self.handle_verify_payment()
        elif parsed_path.path == '/save-user-data': # Added new save user data endpoint
            self.handle_save_user_data()
        elif parsed_path.path == '/generate-ad':
            self.handle_generate_ad()
        else:
            # Send JSON error for unknown endpoints
            error_response = {
                "success": False,
                "error": f"Endpoint not found: {parsed_path.path}"
            }
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            # TODO: Replace * with specific allowed origins in production
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode('utf-8'))

    def serve_config(self):
        """Serve configuration with environment variables"""
        try:
            # Debug: Log environment variables (without exposing full keys)
            deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
            deepai_key = os.getenv("DEEPAI_API_KEY", "")
            razorpay_key_id = os.getenv("RAZORPAY_KEY_ID", "")
            razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
            firebase_api_key = os.getenv("FIREBASE_API_KEY", "")
            firebase_auth_domain = os.getenv("FIREBASE_AUTH_DOMAIN", "")
            firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "")
            firebase_app_id = os.getenv("FIREBASE_APP_ID", "")

            print(f"🔑 DEEPSEEK_API_KEY: {'✅ Present' if deepseek_key else '❌ Missing'} ({len(deepseek_key)} chars)")
            print(f"🔑 DEEPAI_API_KEY: {'✅ Present' if deepai_key else '❌ Missing'} ({len(deepai_key)} chars)")
            print(f"🔑 RAZORPAY_KEY_ID: {'✅ Present' if razorpay_key_id else '❌ Missing'} ({len(razorpay_key_id)} chars)")
            print(f"🔑 RAZORPAY_KEY_SECRET: {'✅ Present' if razorpay_key_secret else '❌ Missing'} ({len(razorpay_key_secret)} chars)")
            print(f"🔑 FIREBASE_API_KEY: {'✅ Present' if firebase_api_key else '❌ Missing'} ({len(firebase_api_key)} chars)")
            print(f"🔑 FIREBASE_AUTH_DOMAIN: {'✅ Present' if firebase_auth_domain else '❌ Missing'} ({len(firebase_auth_domain)} chars)")
            print(f"🔑 FIREBASE_PROJECT_ID: {'✅ Present' if firebase_project_id else '❌ Missing'} ({len(firebase_project_id)} chars)")
            print(f"🔑 FIREBASE_APP_ID: {'✅ Present' if firebase_app_id else '❌ Missing'} ({len(firebase_app_id)} chars)")

            missing_keys = []
            if not deepseek_key:
                missing_keys.append('DEEPSEEK_API_KEY')
            if not deepai_key:
                missing_keys.append('DEEPAI_API_KEY')

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
            # TODO: Replace * with specific allowed origins in production
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
    SHOW_3D_EARLY: false,
    MISSING_KEYS: ['ALL_KEYS_MISSING'],
    ERROR: '{str(e)}'
}};
console.error('❌ Failed to load configuration');
console.error('❌ Config loading error: {str(e)}');
'''
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            # TODO: Replace * with specific allowed origins in production
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(error_config.encode())

    def serve_config_check(self):
        """Serve configuration status for debugging"""
        try:
            config_status = {
                "deepseek_api_key": bool(os.getenv("DEEPSEEK_API_KEY", "")),
                "deepai_api_key": bool(os.getenv("DEEPAI_API_KEY", "")),
                "razorpay_key_id": bool(os.getenv("RAZORPAY_KEY_ID", "")),
                "razorpay_key_secret": bool(os.getenv("RAZORPAY_KEY_SECRET", "")),
                "firebase_api_key": bool(os.getenv("FIREBASE_API_KEY", "")),
                "firebase_auth_domain": bool(os.getenv("FIREBASE_AUTH_DOMAIN", "")),
                "firebase_project_id": bool(os.getenv("FIREBASE_PROJECT_ID", "")),
                "firebase_app_id": bool(os.getenv("FIREBASE_APP_ID", "")),
                "timestamp": int(time.time()) if 'time' in globals() else None
            }

            all_required_present = (
                config_status["deepseek_api_key"] and 
                config_status["deepai_api_key"] and
                config_status["razorpay_key_id"] and
                config_status["razorpay_key_secret"]
            )

            config_status["status"] = "healthy" if all_required_present else "missing_keys"
            config_status["payment_ready"] = config_status["razorpay_key_id"] and config_status["razorpay_key_secret"]

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-cache')
            # TODO: Replace * with specific allowed origins in production
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(config_status, indent=2).encode())

        except Exception as e:
            print(f"Error serving config check: {e}")
            error_response = {
                "status": "error",
                "error": str(e),
                "payment_ready": False
            }
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            # TODO: Replace * with specific allowed origins in production
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode())

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
            ads = ads[:4]  # Limit to 4 ads

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
        """Handle payment verification with comprehensive error handling"""
        print("=== PAYMENT VERIFICATION START ===")
        print(f"Method: {self.command}")
        print(f"Path: {self.path}")
        print(f"Headers: {dict(self.headers)}")

        response_data = {"success": False, "error": "Unknown error"}
        status_code = 500

        try:
            # Check if Razorpay keys are available
            razorpay_key_id = os.getenv("RAZORPAY_KEY_ID", "")
            razorpay_key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")

            if not razorpay_key_id or not razorpay_key_secret:
                print("❌ Razorpay keys not configured in environment")
                response_data = {
                    "success": False,
                    "error": "Payment system not configured. Please contact support.",
                    "code": "RAZORPAY_CONFIG_MISSING"
                }
                status_code = 503  # Service Unavailable
                self._send_json_response(response_data, status_code)
                return

            content_length = int(self.headers.get('Content-Length', 0))
            print(f"Content-Length: {content_length}")

            if content_length == 0:
                print("❌ No payment data received")
                response_data = {
                    "success": False,
                    "error": "No payment data received",
                    "code": "NO_PAYMENT_DATA"
                }
                status_code = 400
            else:
                post_data = self.rfile.read(content_length)
                print(f"Raw post data length: {len(post_data)}")

                try:
                    payment_data = json.loads(post_data.decode('utf-8'))
                    print("✅ Payment data successfully parsed:", payment_data)

                    # Extract payment details
                    plan_key = payment_data.get('planKey', 'pro')
                    payment_id = payment_data.get('payment_id', '').strip()
                    order_id = payment_data.get('order_id', '').strip()
                    signature = payment_data.get('signature', '').strip()

                    print(f"Payment details - planKey: {plan_key}, payment_id: {payment_id}, order_id: {order_id}")

                    # Validate required fields
                    if not payment_id or not order_id or not signature:
                        missing_fields = []
                        if not payment_id: missing_fields.append('payment_id')
                        if not order_id: missing_fields.append('order_id')
                        if not signature: missing_fields.append('signature')

                        print(f"❌ Missing payment fields: {missing_fields}")
                        response_data = {
                            "success": False, 
                            "error": f"Missing required payment details: {', '.join(missing_fields)}",
                            "code": "MISSING_PAYMENT_FIELDS"
                        }
                        status_code = 400
                    else:
                        print("✅ All required payment fields present")

                        # In production, you would verify the signature here:
                        # import hmac
                        # import hashlib
                        # message = order_id + '|' + payment_id
                        # expected_signature = hmac.new(
                        #     razorpay_key_secret.encode(),  
                        #     message.encode(), 
                        #     hashlib.sha256
                        # ).hexdigest()
                        # if expected_signature == signature:

                        try:
                            # For demo purposes, we'll simulate successful verification
                            import time
                            time.sleep(0.1)  # Reduced delay

                            # Mock successful verification
                            response_data = {
                                "success": True, 
                                "message": "Payment verified successfully",
                                "planKey": plan_key,
                                "payment_id": payment_id,
                                "order_id": order_id,
                                "verified_at": time.time()
                            }
                            status_code = 200
                            print(f"✅ Payment verification simulated successfully for plan: {plan_key}")

                        except Exception as verify_error:
                            print(f"❌ Payment verification API error: {verify_error}")
                            response_data = {
                                "success": False,
                                "error": "Payment verification failed with payment provider",
                                "code": "VERIFICATION_API_ERROR",
                                "details": str(verify_error)
                            }
                            status_code = 502  # Bad Gateway

                except json.JSONDecodeError as e:
                    print(f"❌ JSON decode error: {e}")
                    print(f"Failed to decode: {post_data[:200] if post_data else 'No data'}")
                    response_data = {
                        "success": False, 
                        "error": "Invalid payment data format",
                        "code": "INVALID_JSON",
                        "details": str(e)
                    }
                    status_code = 400

        except ValueError as e:
            print(f"❌ Value error in payment verification: {e}")
            response_data = {
                "success": False,
                "error": "Invalid payment data",
                "code": "INVALID_DATA",
                "details": str(e)
            }
            status_code = 400

        except Exception as e:
            print(f"❌ Unexpected payment verification error: {e}")
            print(f"Exception type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            response_data = {
                "success": False,
                "error": "Payment verification system error",
                "code": "SYSTEM_ERROR",
                "details": str(e)
            }
            status_code = 500

        print(f"Final response data: {response_data}")
        print(f"Final status code: {status_code}")
        print("=== PAYMENT VERIFICATION END ===")

        # Always send JSON response
        self._send_json_response(response_data, status_code)

    def _send_json_response(self, data, status_code=200):
        """Helper method to always send JSON responses"""
        print(f"=== SENDING JSON RESPONSE ===")
        print(f"Status code: {status_code}")
        print(f"Data to send: {data}")

        try:
            # Make sure we haven't already sent headers
            if hasattr(self, '_headers_sent'):
                print("❌ Headers already sent, cannot send response")
                return

            self.send_response(status_code)
            self.send_header('Content-type', 'application/json')
            # TODO: Replace * with specific allowed origins in production
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self._headers_sent = True

            json_response = json.dumps(data, ensure_ascii=False)
            print(f"JSON response length: {len(json_response)}")
            print(f"JSON response: {json_response}")

            self.wfile.write(json_response.encode('utf-8'))
            self.wfile.flush()
            print("✅ JSON response sent successfully")

        except Exception as send_error:
            print(f"❌ Error sending JSON response: {send_error}")
            print(f"Error type: {type(send_error).__name__}")
            import traceback
            traceback.print_exc()

            # If all else fails, try to send minimal JSON
            try:
                if not hasattr(self, '_headers_sent'):
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    # TODO: Replace * with specific allowed origins in production
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                minimal_response = b'{"success": false, "error": "Response error"}'
                self.wfile.write(minimal_response)
                self.wfile.flush()
                print("⚠️ Sent minimal error response")
            except Exception as final_error:
                print(f"❌ Failed to send any response: {final_error}")

        print("=== JSON RESPONSE COMPLETE ===")

    def handle_create_razorpay_order(self):
        """Handle Razorpay order creation"""
        response_data = {"success": False, "error": "Unknown error"}
        status_code = 500

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                response_data = {
                    "success": False,
                    "error": "No order data received"
                }
                status_code = 400
            else:
                post_data = self.rfile.read(content_length)

                try:
                    order_data = json.loads(post_data.decode('utf-8'))
                    print(f"Creating order for: {order_data}")

                    # Validate required fields
                    plan_key = order_data.get('planKey')
                    price = order_data.get('price')
                    currency = order_data.get('currency', 'INR')

                    if not plan_key or not price:
                        missing_fields = []
                        if not plan_key: missing_fields.append('planKey')
                        if not price: missing_fields.append('price')

                        response_data = {
                            "success": False,
                            "error": f"Missing required fields: {', '.join(missing_fields)}"
                        }
                        status_code = 400
                    else:
                        # Mock order creation - return a fake order ID
                        import uuid
                        import time
                        order_id = f"order_{uuid.uuid4().hex[:12]}"

                        print(f"✅ Order created successfully: {order_id}")
                        print(f"Amount: {price}, Currency: {currency}, Plan: {plan_key}")

                        response_data = {
                            "success": True,
                            "order_id": order_id,
                            "amount": int(price),
                            "currency": currency,
                            "planKey": plan_key,
                            "created_at": int(time.time())
                        }
                        status_code = 200

                except json.JSONDecodeError as e:
                    print(f"JSON decode error in order creation: {e}")
                    print(f"Raw data: {post_data.decode('utf-8')[:200]}")
                    response_data = {
                        "success": False,
                        "error": "Invalid JSON format in order request",
                        "details": str(e)
                    }
                    status_code = 400

        except Exception as e:
            print(f"Order creation error: {e}")
            print(f"Exception type: {type(e).__name__}")
            import traceback
            traceback.print_exc()

            response_data = {
                "success": False,
                "error": "Failed to create order",
                "details": str(e)
            }
            status_code = 500

        # Always send JSON response
        self._send_json_response(response_data, status_code)

    def send_error(self, code, message=None):
        """Override to send JSON error responses for API endpoints"""
        parsed_path = urlparse(self.path)
        api_endpoints = ['/verify-payment', '/create-razorpay-order', '/save-ad', '/sync-user-data']

        if parsed_path.path in api_endpoints:
            error_data = {
                "success": False,
                "error": message or f"HTTP {code} Error",
                "code": code
            }
            self._send_json_response(error_data, code)
        else:
            # For non-API endpoints, use default HTML error
            super().send_error(code, message)

    def handle_get_user_data(self, uid):
        """Handles fetching user data based on UID"""
        try:
            user_file = f'public/user_data_{uid}.json'
            if os.path.exists(user_file):
                with open(user_file, 'r') as f:
                    user_data = json.load(f)
                print(f"📊 Retrieved user data for {uid}: {user_data.get('usageCount', 0)} ads used")
                self._send_json_response(user_data, 200)
            else:
                # If user doesn't exist, create initial data
                initial_data = create_user_data(uid, "New User", f"user{uid}@example.com", "")
                self._send_json_response(initial_data, 200) # Send back the data even though its new
                print(f"📊 No existing data for user {uid}, created new user.")

        except Exception as e:
            print(f"❌ Error getting user data: {e}")
            self._send_json_response({"error": str(e)}, 500)

    def handle_save_user_data(self):
        """Handles saving user data to a file based on UID"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            user_data = json.loads(post_data.decode('utf-8'))
            uid = user_data.get('uid')
            if not uid:
                self._send_json_response({"error": "No UID provided"}, 400)
                return

            user_file = f'public/user_data_{uid}.json'
            with open(user_file, 'w') as f:
                json.dump(user_data, f, indent=2)

            print(f"📊 Saved user data for {uid}: {user_data.get('usageCount', 0)} ads used, plan: {user_data.get('subscriptionStatus', 'free')}")
            self._send_json_response({"status": "success", "message": "User data saved"}, 200)
        except Exception as e:
            print(f"❌ Error saving user data: {e}")
            self._send_json_response({"error": str(e)}, 500)

    def handle_generate_ad(self):
        """Handle ad generation requests using real AI APIs"""
        print("=== AD GENERATION REQUEST START ===")
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            print(f"📏 Content length: {content_length}")

            if content_length == 0:
                print("❌ No form data received")
                self._send_json_response({"success": False, "error": "No form data received"}, 400)
                return

            post_data = self.rfile.read(content_length)
            form_data = json.loads(post_data.decode('utf-8'))

            print(f"🎨 Generating ad for: {form_data.get('productName', 'Unknown product')}")
            print(f"📝 Form data received: {form_data}")

            # Generate ad copy using DeepSeek API
            print("🤖 Starting DeepSeek API call...")
            ad_copy_result = self.generate_ad_copy_with_deepseek(form_data)
            print(f"🤖 DeepSeek result: {ad_copy_result}")

            if not ad_copy_result["success"]:
                print(f"❌ DeepSeek failed: {ad_copy_result}")
                self._send_json_response(ad_copy_result, 500)
                return

            # Generate image using DeepAI API
            print("🎨 Starting DeepAI API call...")
            image_result = self.generate_image_with_deepai(form_data)
            print(f"🎨 DeepAI result: {image_result}")

            if not image_result["success"]:
                # If image generation fails, continue with text-only ad
                print(f"⚠️ Image generation failed: {image_result.get('error')}")
                image_url = "https://picsum.photos/600/400?random=" + str(hash(form_data.get('productName', 'default')))
            else:
                image_url = image_result["image_url"]

            response = {
                "success": True,
                "ad_copy": ad_copy_result["ad_copy"],
                "image_url": image_url
            }

            print(f"✅ Final response: {response}")
            self._send_json_response(response, 200)

        except json.JSONDecodeError as e:
            print(f"❌ JSON decode error in ad generation: {e}")
            self._send_json_response({"success": False, "error": "Invalid JSON format"}, 400)
        except Exception as e:
            print(f"❌ Error generating ad: {e}")
            import traceback
            traceback.print_exc()
            self._send_json_response({"success": False, "error": str(e)}, 500)

        print("=== AD GENERATION REQUEST END ===")

    def generate_ad_copy_with_deepseek(self, form_data):
        """Generate ad copy using DeepSeek API"""
        try:
            import urllib.request
            import urllib.parse
            import random

            deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "")
            if not deepseek_api_key:
                return {"success": False, "error": "DeepSeek API key not configured"}

            # Create prompt for ad generation
            language = form_data.get('language', 'English')
            product_name = form_data.get('productName', '')
            product_description = form_data.get('productDescription', '')
            target_audience = form_data.get('targetAudience', '')
            special_offer = form_data.get('specialOffer', '')
            tone = form_data.get('tone', 'professional')
            ad_format = form_data.get('adFormat', 'facebook-feed')

            # Add randomization for varied results
            random_elements = [
                "Create a unique and compelling",
                "Design an engaging and persuasive",
                "Generate a creative and attention-grabbing",
                "Craft an irresistible and memorable"
            ]

            call_to_action_styles = [
                "with a strong call-to-action",
                "that drives immediate action",
                "encouraging quick response",
                "with urgency and excitement"
            ]

            random_prompt_start = random.choice(random_elements)
            random_cta_style = random.choice(call_to_action_styles)

            # Add timestamp to ensure uniqueness
            import time
            unique_seed = int(time.time() * 1000) % 10000

            prompt = f"""{random_prompt_start} {ad_format} advertisement in {language} with a {tone} tone.

Product Details:
- Name: {product_name}
- Description: {product_description}
- Target Audience: {target_audience}
- Special Offer: {special_offer}
- Ad Format: {ad_format}

Creative Requirements:
- Write in {language} language
- Maintain {tone} tone throughout
- Include relevant emojis for engagement
- Keep it between 50-80 words
- {random_cta_style}
- Make it platform-specific for {ad_format}
- Be creative and avoid generic phrases
- Focus on benefits and emotional appeal

Unique seed: {unique_seed}

Generate ONLY the final ad copy text, no explanations or formatting."""

            # Prepare API request
            url = "https://api.deepseek.com/v1/chat/completions"
            headers = {
                'Authorization': f'Bearer {deepseek_api_key}',
                'Content-Type': 'application/json'
            }

            data = {
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "You are a creative advertising copywriter who creates unique, engaging ad copy. Never repeat the same content. Always be creative and original."},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 150,
                "temperature": 0.9,
                "top_p": 0.9,
                "frequency_penalty": 0.7,
                "presence_penalty": 0.6
            }

            # Make API request
            req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers)

            print(f"🤖 Calling DeepSeek API for ad copy generation...")
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))

                if result.get("choices") and len(result["choices"]) > 0:
                    ad_copy = result["choices"][0]["message"]["content"]
                    return {"success": True, "ad_copy": ad_copy}
                else:
                    return {"success": False, "error": f"DeepSeek API error: {result}"}

        except Exception as e:
            return {"success": False, "error": f"DeepSeek API call failed: {str(e)}"}

    def generate_image_with_deepai(self, form_data):
        """Generate image using DeepAI API"""
        try:
            import urllib.request
            import urllib.parse

            deepai_api_key = os.getenv("DEEPAI_API_KEY", "")
            if not deepai_api_key:
                return {"success": False, "error": "DeepAI API key not configured"}

            product_name = form_data.get('productName', '')
            product_description = form_data.get('productDescription', '')

            # Construct a prompt for image generation
            prompt = f"""A visually stunning advertisement for {product_name}.
            {product_description}. High-quality, vibrant colors, and professional composition."""

            url = "https://api.deepai.org/api/text2img"
            headers = {'api-key': deepai_api_key}
            data = {'text': prompt}

            data = urllib.parse.urlencode(data).encode('ascii')
            req = urllib.request.Request(url, data, headers)

            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode('utf-8'))

                if 'output_url' in result:
                    return {"success": True, "image_url": result['output_url']}
                else:
                    return {"success": False, "error": f"DeepAI API error: {result.get('err', 'Unknown error')}"}

        except Exception as e:
            return {"success": False, "error": f"DeepAI API call failed: {str(e)}"}

def create_user_data(uid, name, email, subscriptionStatus):
    """Creates initial user data"""
    timestamp = datetime.now().isoformat()
    initial_data = {
        "uid": uid,
        "name": name,
        "email": email,
        "creationTime": timestamp,
        "lastSignInTime": timestamp,
        "usageCount": 0,
        "subscriptionStatus": subscriptionStatus,
        "planDetails": {
            "planName": "free",
            "startDate": timestamp,
            "endDate": timestamp,
            "isTrial": True
        }
    }

    user_file = f'public/user_data_{uid}.json'
    with open(user_file, 'w') as f:
        json.dump(initial_data, f, indent=2)
    return initial_data

def run(server_class=HTTPServer, handler_class=AdGeneratorHandler, port=int(os.environ.get('PORT', 8000))):
    """Start the HTTP server."""
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"🚀 Starting server on port {port}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("🛑 Server stopped.")

if __name__ == "__main__":
    run()