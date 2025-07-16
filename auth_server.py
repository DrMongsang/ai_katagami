import http.server
import socketserver
import base64
import os

PORT = 8000
USERNAME = "user"
PASSWORD = "2525"

class AuthHandler(http.server.SimpleHTTPRequestHandler):
    def do_HEAD(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.headers.get('Authorization') == None:
            self.do_AUTHHEAD()
        elif self.headers.get('Authorization') == "Basic " + self.auth_string():
            http.server.SimpleHTTPRequestHandler.do_GET(self)
        else:
            self.do_AUTHHEAD()

    def do_AUTHHEAD(self):
        self.send_response(401)
        self.send_header('WWW-Authenticate', 'Basic realm="Test" ')
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(bytes("<html><head><title>Authentication required</title></head><body><h1>Authentication required</h1></body></html>", "utf-8"))

    def auth_string(self):
        return base64.b64encode(bytes(f"{USERNAME}:{PASSWORD}", "utf-8")).decode("utf-8")

# Change the current working directory to serve files from the correct location
os.chdir(r"C:\Users\owner\Downloads\採寸アプリ")

with socketserver.TCPServer(("", PORT), AuthHandler) as httpd:
    print(f"serving at port {PORT}")
    print(f"Username: {USERNAME}, Password: {PASSWORD}")
    httpd.serve_forever()
