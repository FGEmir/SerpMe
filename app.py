"""Local development server and secure SerpAPI proxy for Pazar Pusulası."""
import json
import os
import time
from collections import defaultdict, deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlencode
from urllib.request import urlopen


ROOT = Path(__file__).parent
PUBLIC_FILES = {"/", "/index.html", "/styles.css", "/app.js"}
REQUEST_WINDOW_SECONDS = 60
MAX_SEARCHES_PER_WINDOW = 3
CACHE_SECONDS = 300
REQUEST_LOG = defaultdict(deque)
RESPONSE_CACHE = {}
CACHE_LOCK = Lock()


def load_local_env():
    """Load local secrets without requiring a third-party dotenv package."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" not in line or line.lstrip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()


def demo_results(business, location):
    """Keep the product demonstrable before a team adds its SerpAPI key."""
    prefix = location.split(",")[0].strip()
    names = [f"Mola {business.title()}", f"{prefix} {business.title()}", f"Atölye {business.title()}", f"Rota {business.title()}", f"Mahalle {business.title()}", f"Gün Işığı {business.title()}"]
    seed = sum(ord(letter) for letter in business.lower()) % 5
    ratings = [4.5, 4.1, 4.3, 3.9, 4.6, 4.0]
    reviews = [482, 129, 267, 76, 351, 94]
    ratings = [round(max(3.5, rating - seed * .08), 1) for rating in ratings]
    reviews = [max(35, count - seed * 47) for count in reviews]
    return {"demo": True, "local_results": [{"title": name, "rating": ratings[i], "reviews": reviews[i], "address": f"{location} çevresi", "open_state": "Açık" if i != 3 else "Kapalı"} for i, name in enumerate(names)]}


class AppHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        from urllib.parse import urlparse
        path = urlparse(self.path).path
        if path == "/healthz":
            return self.send_json({"status": "ok", "service": "pazar-pusulasi"})
        if path == "/api/search":
            return self.search()
        if path not in PUBLIC_FILES:
            self.send_error(404, "Bulunamadı")
            return
        self.path = "/index.html" if path == "/" else path
        return super().do_GET()

    def search(self):
        from urllib.parse import parse_qs, urlparse
        query = parse_qs(urlparse(self.path).query)
        business = query.get("business", [""])[0].strip()
        location = query.get("location", [""])[0].strip()
        try:
            radius = max(100, min(10000, int(query.get("radius", ["1000"])[0])))
        except ValueError:
            radius = 1000
        try:
            latitude = float(query.get("latitude", [""])[0])
            longitude = float(query.get("longitude", [""])[0])
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                raise ValueError
        except ValueError:
            latitude = longitude = None
        concepts = [item.strip() for item in query.get("concepts", [""])[0].split(",") if item.strip()][:3]
        api_key = os.environ.get("SERPAPI_KEY")
        if not business or not location or len(business) > 120 or len(location) > 200:
            return self.send_json({"error": "İşletme tipi ve konum zorunludur."}, 400)
        cache_key = (business.lower(), location.lower(), radius, latitude, longitude, tuple(concepts))
        cached = self.cached_response(cache_key)
        if cached:
            return self.send_json(cached)
        if not self.rate_limit_ok():
            return self.send_json({"error": "Çok fazla analiz isteği gönderildi. Lütfen bir dakika sonra tekrar deneyin."}, 429)
        if not api_key:
            payload = demo_results(business, location)
            payload["search_radius_m"] = radius
            payload["precision_mode"] = "gps" if latitude is not None else "text"
            payload["concept_analysis"] = {concept: demo_results(concept, location)["local_results"] for concept in concepts if concept.lower() != business.lower()}
            self.cache_response(cache_key, payload)
            return self.send_json(payload)
        try:
            payload = self.maps_search(business, location, radius, latitude, longitude, api_key)
            payload["search_radius_m"] = radius
            payload["precision_mode"] = "gps" if latitude is not None else "text"
            payload["concept_analysis"] = {concept: self.maps_search(concept, location, radius, latitude, longitude, api_key).get("local_results", []) for concept in concepts if concept.lower() != business.lower()}
            self.cache_response(cache_key, payload)
            self.send_json(payload)
        except Exception:
            self.send_json({"error": "Veri sağlayıcısına şu anda erişilemiyor. Lütfen daha sonra tekrar deneyin."}, 502)

    def rate_limit_ok(self):
        now = time.monotonic()
        client = self.client_address[0]
        with CACHE_LOCK:
            history = REQUEST_LOG[client]
            while history and now - history[0] > REQUEST_WINDOW_SECONDS:
                history.popleft()
            if len(history) >= MAX_SEARCHES_PER_WINDOW:
                return False
            history.append(now)
            return True

    @staticmethod
    def cached_response(key):
        with CACHE_LOCK:
            entry = RESPONSE_CACHE.get(key)
            if entry and time.monotonic() - entry[0] < CACHE_SECONDS:
                return entry[1]
            RESPONSE_CACHE.pop(key, None)
            return None

    @staticmethod
    def cache_response(key, payload):
        with CACHE_LOCK:
            RESPONSE_CACHE[key] = (time.monotonic(), payload)

    @staticmethod
    def maps_search(business, location, radius, latitude, longitude, api_key):
        params = {
            "engine": "google_maps",
            "type": "search",
            "q": f"{business} in {location}",
            "api_key": api_key,
            "hl": "tr",
        }
        if latitude is not None:
            zoom = 16 if radius <= 500 else 15 if radius <= 1000 else 14 if radius <= 2000 else 13
            params["ll"] = f"@{latitude},{longitude},{zoom}z"
        with urlopen("https://serpapi.com/search.json?" + urlencode(params), timeout=25) as response:
            return json.load(response)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    port = int(os.environ.get("PORT", "8000"))
    print(f"Pazar Pusulası: http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), AppHandler).serve_forever()
