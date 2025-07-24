
#!/usr/bin/env python3
import os
import json
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

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
        else:
            self.send_error(404, "Not Found")
    
    def serve_config(self):
        """Serve configuration with environment variables"""
        try:
            config_js = f'''
window.CONFIG = {{
    DEEPSEEK_API_KEY: '{os.getenv("DEEPSEEK_API_KEY", "")}',
    DEEPAI_API_KEY: '{os.getenv("DEEPAI_API_KEY", "")}',
    GOOGLE_CLIENT_ID: '{os.getenv("GOOGLE_CLIENT_ID", "")}',
    RAZORPAY_KEY_ID: '{os.getenv("RAZORPAY_KEY_ID", "")}',
    RAZORPAY_KEY_SECRET: '{os.getenv("RAZORPAY_KEY_SECRET", "")}'
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
            ads = ads[:50]  # Keep only last 50 ads
            
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
