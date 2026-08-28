"""Local development server and secure SerpAPI proxy for SerpMe."""
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
PUBLIC_FILES = {"/", "/index.html", "/styles.css", "/app.js", "/about.html", "/login.html"}
REQUEST_WINDOW_SECONDS = 60
MAX_SEARCHES_PER_WINDOW = 3
PROVIDER_WINDOW_SECONDS = 3600
MAX_PROVIDER_CALLS_PER_WINDOW = int(os.environ.get("MAX_SERPAPI_CALLS_PER_HOUR", "30"))
CACHE_SECONDS = 300
MAX_CACHE_ENTRIES = 128
REQUEST_LOG = defaultdict(deque)
RESPONSE_CACHE = {}
CACHE_LOCK = Lock()
PROVIDER_CALL_LOG = deque()


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
            return self.send_json({"error": "Kaynak bulunamadı."}, 404)
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
        concepts = [item.strip() for item in query.get("concepts", [""])[0].split(",") if item.strip()][:3]
        api_key = os.environ.get("SERPAPI_KEY")
        if not business or not location or len(business) > 120 or len(location) > 200:
            return self.send_json({"error": "İşletme tipi ve konum zorunludur."}, 400)
        cache_key = (business.lower(), location.lower(), radius, tuple(concepts))
        cached = self.cached_response(cache_key)
        if cached:
            return self.send_json(cached)
        if not self.rate_limit_ok():
            return self.send_json({"error": "Çok fazla analiz isteği gönderildi. Lütfen bir dakika sonra tekrar deneyin."}, 429)
        if not api_key:
            payload = demo_results(business, location)
            payload["search_radius_m"] = radius
            payload["precision_mode"] = "text"
            payload["concept_analysis"] = {concept: demo_results(concept, location)["local_results"] for concept in concepts if concept.lower() != business.lower()}
            self.cache_response(cache_key, payload)
            return self.send_json(payload)
        provider_calls = 1 + sum(1 for concept in concepts if concept.lower() != business.lower())
        if not self.provider_budget_ok(provider_calls):
            return self.send_json({"error": "Güncel analiz kotası doldu. Lütfen daha sonra tekrar deneyin."}, 429)
        try:
            payload = self.maps_search(business, location, api_key)
            payload["search_radius_m"] = radius
            payload["precision_mode"] = "text"
            payload["concept_analysis"] = {concept: self.maps_search(concept, location, api_key).get("local_results", []) for concept in concepts if concept.lower() != business.lower()}
            self.cache_response(cache_key, payload)
            self.send_json(payload)
        except Exception:
            self.send_json({"error": "Veri sağlayıcısına şu anda erişilemiyor. Lütfen daha sonra tekrar deneyin."}, 502)

    def rate_limit_ok(self):
        now = time.monotonic()
        # Render forwards the originating client through this header. The global
        # provider budget below remains the cost-control boundary if it is absent
        # or intentionally forged by an upstream client.
        forwarded_for = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
        client = forwarded_for or self.client_address[0]
        with CACHE_LOCK:
            history = REQUEST_LOG[client]
            while history and now - history[0] > REQUEST_WINDOW_SECONDS:
                history.popleft()
            if len(history) >= MAX_SEARCHES_PER_WINDOW:
                return False
            history.append(now)
            return True

    @staticmethod
    def provider_budget_ok(call_count):
        """Cap paid upstream requests even when public clients rotate IPs."""
        now = time.monotonic()
        with CACHE_LOCK:
            while PROVIDER_CALL_LOG and now - PROVIDER_CALL_LOG[0] > PROVIDER_WINDOW_SECONDS:
                PROVIDER_CALL_LOG.popleft()
            if len(PROVIDER_CALL_LOG) + call_count > MAX_PROVIDER_CALLS_PER_WINDOW:
                return False
            PROVIDER_CALL_LOG.extend([now] * call_count)
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
            if len(RESPONSE_CACHE) >= MAX_CACHE_ENTRIES:
                oldest_key = min(RESPONSE_CACHE, key=lambda item: RESPONSE_CACHE[item][0])
                RESPONSE_CACHE.pop(oldest_key, None)
            RESPONSE_CACHE[key] = (time.monotonic(), payload)

    @staticmethod
    def maps_search(business, location, api_key):
        params = {
            "engine": "google_maps",
            "type": "search",
            "q": f"{business} in {location}",
            "api_key": api_key,
            "hl": "tr",
        }
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
        self.send_header("Strict-Transport-Security", "max-age=31536000")
        self.send_header("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-src https://www.google.com https://maps.google.com")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    port = int(os.environ.get("PORT", "8000"))
    print(f"SerpMe: http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), AppHandler).serve_forever()
