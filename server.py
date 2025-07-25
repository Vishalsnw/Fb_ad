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

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
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
        elif parsed_path.path == '/verify-payment':
            self.handle_verify_payment()
        elif parsed_path.path == '/create-razorpay-order':
            self.handle_create_razorpay_order()
        else:
            # Send JSON error for unknown endpoints
            error_response = {
                "success": False,
                "error": f"Endpoint not found: {parsed_path.path}"
            }
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode('utf-8'))

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
        """Handle payment verification and ensure JSON responses"""
        print("=== PAYMENT VERIFICATION START ===")
        print(f"Method: {self.command}")
        print(f"Path: {self.path}")
        print(f"Headers: {dict(self.headers)}")
        
        response_data = {"success": False, "error": "Unknown error"}
        status_code = 500
        
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            print(f"Content-Length: {content_length}")
            
            if content_length == 0:
                print("❌ No payment data received")
                response_data = {
                    "success": False,
                    "error": "No payment data received"
                }
                status_code = 400
            else:
                post_data = self.rfile.read(content_length)
                print(f"Raw post data length: {len(post_data)}")
                print(f"Raw post data: {post_data}")
                
                try:
                    payment_data = json.loads(post_data.decode('utf-8'))
                    print("✅ Payment data successfully parsed:", payment_data)
                    
                    # Mock payment verification - in production, verify with Razorpay
                    plan_key = payment_data.get('planKey', 'pro')
                    payment_id = payment_data.get('payment_id')
                    order_id = payment_data.get('order_id')
                    signature = payment_data.get('signature')
                    
                    print(f"Payment details - planKey: {plan_key}, payment_id: {payment_id}, order_id: {order_id}, signature: {signature}")
                    
                    if payment_id and order_id and signature:
                        print("✅ All required payment fields present")
                        # Simulate successful verification
                        response_data = {
                            "success": True, 
                            "message": "Payment verified successfully",
                            "planKey": plan_key,
                            "payment_id": payment_id,
                            "order_id": order_id
                        }
                        status_code = 200
                    else:
                        missing_fields = []
                        if not payment_id: missing_fields.append('payment_id')
                        if not order_id: missing_fields.append('order_id')
                        if not signature: missing_fields.append('signature')
                        
                        print(f"❌ Missing payment fields: {missing_fields}")
                        response_data = {
                            "success": False, 
                            "error": f"Missing required payment details: {', '.join(missing_fields)}"
                        }
                        status_code = 400
                        
                except json.JSONDecodeError as e:
                    print(f"❌ JSON decode error: {e}")
                    print(f"Failed to decode: {post_data}")
                    response_data = {
                        "success": False, 
                        "error": "Invalid JSON format in request",
                        "details": str(e)
                    }
                    status_code = 400

        except Exception as e:
            print(f"❌ Payment verification error: {e}")
            print(f"Exception type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            response_data = {
                "success": False,
                "error": "Payment verification failed",
                "details": str(e)
            }
            status_code = 500

        print(f"Final response data: {response_data}")
        print(f"Final status code: {status_code}")
        print("=== PAYMENT VERIFICATION END ===")
        
        # Always send JSON response - override the default error handling
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
                        order_id = f"order_{uuid.uuid4().hex[:12]}"

                        response_data = {
                            "success": True,
                            "order_id": order_id,
                            "amount": int(price),
                            "currency": currency,
                            "planKey": plan_key
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