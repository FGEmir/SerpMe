"""Local development server and secure SerpAPI proxy for Pazar Pusulası."""
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


ROOT = Path(__file__).parent


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
        if self.path == "/healthz":
            return self.send_json({"status": "ok", "service": "pazar-pusulasi"})
        if self.path.startswith("/api/search"):
            return self.search()
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
        if not business or not location:
            return self.send_json({"error": "İşletme tipi ve konum zorunludur."}, 400)
        if not api_key:
            payload = demo_results(business, location)
            payload["search_radius_m"] = radius
            payload["precision_mode"] = "gps" if latitude is not None else "text"
            payload["concept_analysis"] = {concept: demo_results(concept, location)["local_results"] for concept in concepts if concept.lower() != business.lower()}
            return self.send_json(payload)
        try:
            payload = self.maps_search(business, location, radius, latitude, longitude, api_key)
            payload["search_radius_m"] = radius
            payload["precision_mode"] = "gps" if latitude is not None else "text"
            payload["concept_analysis"] = {concept: self.maps_search(concept, location, radius, latitude, longitude, api_key).get("local_results", []) for concept in concepts if concept.lower() != business.lower()}
            self.send_json(payload)
        except Exception as exc:
            self.send_json({"error": f"SerpAPI isteği tamamlanamadı: {exc}"}, 502)

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


if __name__ == "__main__":
    os.chdir(ROOT)
    port = int(os.environ.get("PORT", "8000"))
    print(f"Pazar Pusulası: http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), AppHandler).serve_forever()
