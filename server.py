import http.server

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()
    def log_message(self, *_):
        pass  # suppress request noise

http.server.test(HandlerClass=NoCacheHandler, port=8765, bind="127.0.0.1")
