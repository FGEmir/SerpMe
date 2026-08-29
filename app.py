"""Local development server and secure SerpAPI proxy for SerpMe."""
import json
import os
import time
import math
from collections import defaultdict, deque
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).parent
PUBLIC_FILES = {"/", "/index.html", "/styles.css", "/liquid.css", "/viability.css", "/smooth.css", "/catalog.css", "/editor.css", "/vision.css", "/vision-controls.css", "/concept-3d.css", "/catalog.js", "/app.js", "/auth.js", "/login.js", "/portfolio.js", "/launch.js", "/launch.css", "/concept-cafe-interior.png", "/supabase-config.js", "/about.html", "/login.html", "/portfolio.html", "/launch.html"}
REQUEST_WINDOW_SECONDS = 60
MAX_SEARCHES_PER_WINDOW = 3
PROVIDER_WINDOW_SECONDS = 3600
MAX_PROVIDER_CALLS_PER_WINDOW = int(os.environ.get("MAX_SERPAPI_CALLS_PER_HOUR", "30"))
RENDER_WINDOW_SECONDS = 3600
MAX_RENDERS_PER_WINDOW = int(os.environ.get("MAX_CONCEPT_RENDERS_PER_HOUR", "12"))
MAX_RENDERS_PER_CLIENT = int(os.environ.get("MAX_CONCEPT_RENDERS_PER_CLIENT_HOUR", "2"))
CACHE_SECONDS = 300
MAX_CACHE_ENTRIES = 128
REQUEST_LOG = defaultdict(deque)
RESPONSE_CACHE = {}
CACHE_LOCK = Lock()
PROVIDER_CALL_LOG = deque()
RENDER_CALL_LOG = defaultdict(deque)
RADIUS_LADDER = (500, 1000, 2000, 3000, 5000)
PROXY_GROUPS = {
    "commercial_activity": "restoran OR fast food OR alışveriş merkezi OR mağaza OR market",
    "target_customer_presence": "üniversite OR okul OR ofis OR plaza OR otel OR spor salonu",
    "accessibility": "metro istasyonu OR tren istasyonu OR otobüs durağı",
    "indirect_demand": "kafe OR restoran OR market OR mağaza",
}


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


def demo_payload(business, location, radius, concepts, provider_status=None):
    """Return clearly-labelled fallback data when no live lookup is possible."""
    payload = demo_results(business, location)
    direct_by_radius = {str(item): demo_results(business, f"{location} · {item} m")["local_results"] for item in RADIUS_LADDER}
    proxy_results = {key: demo_results(label.split(" OR ")[0], location)["local_results"] for key, label in PROXY_GROUPS.items()}
    payload.update({
        "search_radius_m": radius,
        "precision_mode": "approximate_viewport",
        "direct_by_radius": direct_by_radius,
        "proxy_results": proxy_results,
        "market_analysis": build_market_analysis(direct_by_radius, proxy_results, False),
        "concept_analysis": {concept: demo_results(concept, location)["local_results"] for concept in concepts if concept.lower() != business.lower()},
    })
    if provider_status:
        payload["provider_status"] = provider_status
    return payload


def radius_zoom(radius):
    """Approximate a Google Maps viewport that matches the requested radius."""
    return max(11, min(17, round(16 - math.log2(max(radius, 500) / 500))))


def place_key(place):
    return place.get("data_id") or place.get("place_id") or f'{place.get("title", "")}|{place.get("address", "")}'


def merge_places(*groups):
    merged = {}
    for group in groups:
        for place in group or []:
            merged[place_key(place)] = place
    return list(merged.values())


def review_count(place):
    value = place.get("reviews", 0)
    try:
        return max(0, int(str(value).replace(".", "").replace(",", "").split()[0]))
    except (TypeError, ValueError, IndexError):
        return 0


def signal_strength(places, count_target=20, review_target=300):
    if not places:
        return 0
    avg_reviews = sum(review_count(place) for place in places) / len(places)
    return round(min(100, len(places) / count_target * 65 + math.log10(avg_reviews + 1) / math.log10(review_target + 1) * 35))


def build_market_analysis(direct_by_radius, proxy_results, live):
    """Build only evidence-backed scores; absent sources reduce confidence."""
    nearest = direct_by_radius.get("500", [])
    direct_count = len(nearest)
    mode = "demand_validation" if direct_count <= 2 else "early_market" if direct_count <= 10 else "competition"
    all_direct = merge_places(*(direct_by_radius.values()))
    direct_reviews = signal_strength(all_direct, 18, 500)
    commercial = signal_strength(proxy_results.get("commercial_activity", []), 20, 350)
    target = signal_strength(proxy_results.get("target_customer_presence", []), 15, 200)
    accessibility = signal_strength(proxy_results.get("accessibility", []), 10, 100)
    indirect = signal_strength(proxy_results.get("indirect_demand", []), 18, 300)
    neighbor_counts = {radius: len(places) for radius, places in direct_by_radius.items()}
    outer_count = max(neighbor_counts.values(), default=0)
    neighbor = round(min(100, outer_count * 5 + direct_reviews * .35)) if outer_count > direct_count else 0
    competition_gap = round(max(0, 100 - min(100, direct_count * 9)))
    location_compatibility = round((commercial + target + accessibility + indirect) / 4) if proxy_results else 0
    demand = round(direct_reviews * .35 + commercial * .25 + target * .2 + indirect * .2)
    components = {
        "demand": demand,
        "commercial_activity": commercial,
        "target_customer_presence": target,
        "accessibility": accessibility,
        "competition_gap": competition_gap,
        "neighbor_market_signal": neighbor,
        "location_compatibility": location_compatibility,
    }
    weights = {"demand": .30, "commercial_activity": .20, "target_customer_presence": .15, "accessibility": .10, "competition_gap": .10, "neighbor_market_signal": .10, "location_compatibility": .05}
    score = round(sum(components[key] * weight for key, weight in weights.items()))
    evidence_groups = 1 + len([items for items in proxy_results.values() if items])
    confidence_score = min(90 if live else 55, 28 + evidence_groups * 12 + (12 if all_direct else 0))
    confidence = "yüksek" if confidence_score >= 75 else "orta" if confidence_score >= 50 else "düşük"
    if location_compatibility < 25 and demand < 30:
        classification = "İşletme tipi bölgeyle uyumsuz"
    elif mode == "demand_validation" and (confidence_score < 65 or demand < 55):
        classification = "Talep belirsiz — doğrulama gerekli"
    elif score >= 58:
        classification = "Fırsat"
    else:
        classification = "Talep belirsiz — doğrulama gerekli"
    reasons = []
    reasons.append(f"500 m içinde {direct_count} doğrudan rakip bulundu; bu tek başına fırsat olarak yorumlanmadı.")
    if outer_count > direct_count:
        reasons.append(f"Komşu pazarda 5 km'ye kadar {outer_count} benzersiz doğrudan işletme sinyali var.")
    if commercial:
        reasons.append(f"Restoran, perakende ve market görünürlüğü ticari aktiviteyi {commercial}/100 düzeyinde destekliyor.")
    if not proxy_results:
        reasons.append("Talep proxy sorguları mevcut veri/kota koşullarında çalışmadı; sonuç güveni düşürüldü.")
    if mode == "demand_validation":
        method = {
            "id": "catchment_proxy_validation",
            "title": "Talep havzası doğrulaması",
            "summary": "Doğrudan emsal yetersiz olduğu için sonuç, rakip sayısına değil çevredeki ticari hareket, hedef müşteri varlığı, erişim ve komşu pazar sinyallerine dayanır.",
            "steps": [
                "Sabah, öğle ve akşam aynı noktada 15'er dakikalık yaya sayımı yapın.",
                "En az 15 potansiyel müşteriyle ihtiyaç ve fiyat hassasiyeti görüşmesi yapın.",
                "7–14 günlük düşük maliyetli menü, pop-up veya ön sipariş testiyle gerçek talebi ölçün.",
            ],
        }
    else:
        method = {
            "id": "direct_competitor_benchmark",
            "title": "Doğrudan emsal karşılaştırması",
            "summary": "Yeterli sayıda doğrudan emsal bulunduğu için puan, yorum hacmi, yoğunluk ve çevresel sinyaller birlikte karşılaştırılır.",
            "steps": [
                "En güçlü üç rakibin fiyat, menü, servis hızı ve yorum temalarını karşılaştırın.",
                "Kira teklifi ile günlük başa baş işlem hedefini aynı senaryoda test edin.",
                "Farklılaşma teklifinizi sınırlı bir müşteri testiyle doğrulayın.",
            ],
        }
    return {
        "mode": mode, "classification": classification, "score": score,
        "components": components, "weights": weights,
        "confidence": {"level": confidence, "score": confidence_score, "live_data": live},
        "neighbor_market": {"radius_counts": neighbor_counts, "max_radius_m": 5000},
        "proxy_counts": {key: len(value) for key, value in proxy_results.items()},
        "evaluation_method": method,
        "reasons": reasons,
        "limitations": ["Google Maps sonuçları görünür listeyle sınırlıdır; nüfus, kira ve gerçek yaya trafiği ölçülmez.", "Yarıçap, Google Maps görünüm yakınlaştırmasıyla yaklaşık uygulanır."],
    }


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

    def do_POST(self):
        from urllib.parse import urlparse
        if urlparse(self.path).path == "/api/concept-render":
            return self.concept_render()
        return self.send_json({"error": "Kaynak bulunamadı."}, 404)

    def concept_render(self):
        """Create a paid concept render only when explicitly enabled server-side."""
        if os.environ.get("CONCEPT_RENDER_ENABLED", "").lower() != "true":
            return self.send_json({"error": "Fotogerçekçi üretim henüz etkin değil.", "code": "render_disabled"}, 503)
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return self.send_json({"error": "Görsel üretim yapılandırması eksik.", "code": "render_unavailable"}, 503)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= 20_000:
            return self.send_json({"error": "Geçersiz plan isteği."}, 400)
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self.send_json({"error": "Plan verisi okunamadı."}, 400)
        brief = self.render_brief(payload)
        if not brief:
            return self.send_json({"error": "Plan verisi eksik veya geçersiz."}, 400)
        if not self.render_budget_ok():
            return self.send_json({"error": "Görsel üretim kotası doldu. Lütfen daha sonra tekrar deneyin."}, 429)
        try:
            request_body = json.dumps({"model": os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2"), "size": "1536x1024", "quality": "low", "output_format": "png", "n": 1, "prompt": brief}).encode("utf-8")
            request = Request("https://api.openai.com/v1/images/generations", data=request_body, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
            with urlopen(request, timeout=80) as response:
                generated = json.load(response)
            image = (generated.get("data") or [{}])[0].get("b64_json")
            if not image:
                raise ValueError("Provider did not return an image")
            return self.send_json({"image_url": f"data:image/png;base64,{image}", "signature": payload.get("signature", "")})
        except Exception:
            # Never expose provider responses, credentials or implementation details.
            return self.send_json({"error": "Görsel şu anda üretilemedi; plan önizlemesi kullanılabilir."}, 502)

    @staticmethod
    def render_brief(payload):
        """Translate bounded, structured plan data into a provider prompt."""
        plan = payload.get("plan") if isinstance(payload, dict) else None
        floors = payload.get("floors") if isinstance(payload, dict) else None
        if not isinstance(plan, dict) or not isinstance(floors, list) or not 1 <= len(floors) <= 8:
            return None
        concept, model = str(plan.get("concept", "")).strip()[:80], str(plan.get("model", "")).strip()[:30]
        if not concept or model not in {"cafe", "restaurant", "retail", "studio"}:
            return None
        try:
            area = max(20, min(2000, float(plan.get("area"))))
        except (TypeError, ValueError):
            return None
        active = payload.get("active_floor", 0)
        if not isinstance(active, int) or not 0 <= active < len(floors):
            return None
        floor = floors[active] if isinstance(floors[active], dict) else {}
        counts = {kind: len(floor.get(kind, [])) if isinstance(floor.get(kind, []), list) else 0 for kind in ("walls", "obstacles", "doors", "sinks", "zones")}
        if any(value > 40 for value in counts.values()):
            return None
        materials = {"cafe": "warm wood, matte mineral plaster, layered ambient lighting", "restaurant": "refined durable finishes, warm indirect lighting, clear service circulation", "retail": "modular display system, durable flooring, illuminated storefront presentation", "studio": "acoustic surfaces, hygienic wet area, flexible partition system"}[model]
        return ("Photorealistic interior architecture visualization, wide eye-level landscape view. " f"Business concept: {concept}. Approximate net area: {area:.0f} square metres. " f"Plan constraints: {counts['zones']} functional zones, {counts['walls']} interior walls, {counts['doors']} doors, {counts['sinks']} sinks, {counts['obstacles']} fixed obstacles. " "Respect clear circulation and keep the entrance, service and guest zones visibly distinct. " f"Material direction: {materials}. No people, no signage, no brand logo, no text, no watermark.")

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
            payload = demo_payload(business, location, radius, concepts)
            self.cache_response(cache_key, payload)
            return self.send_json(payload)
        provider_calls = len(RADIUS_LADDER) + len(PROXY_GROUPS) + sum(1 for concept in concepts if concept.lower() != business.lower())
        if not self.provider_budget_ok(provider_calls):
            return self.send_json({"error": "Güncel analiz kotası doldu. Lütfen daha sonra tekrar deneyin."}, 429)
        try:
            direct_by_radius = {}
            accumulated = []
            for item in RADIUS_LADDER:
                result = self.maps_search(business, location, api_key, item)
                accumulated = merge_places(accumulated, result.get("local_results", []))
                direct_by_radius[str(item)] = list(accumulated)
            payload = {"local_results": direct_by_radius.get(str(radius), direct_by_radius["1000"])}
            proxy_results = {key: self.maps_search(label, location, api_key, 5000).get("local_results", []) for key, label in PROXY_GROUPS.items()}
            payload["search_radius_m"] = radius
            payload["precision_mode"] = "approximate_viewport"
            payload["direct_by_radius"] = direct_by_radius
            payload["proxy_results"] = proxy_results
            payload["market_analysis"] = build_market_analysis(direct_by_radius, proxy_results, True)
            payload["concept_analysis"] = {concept: self.maps_search(concept, location, api_key, radius).get("local_results", []) for concept in concepts if concept.lower() != business.lower()}
            self.cache_response(cache_key, payload)
            self.send_json(payload)
        except Exception:
            # The user can still explore the product while the upstream provider
            # is unavailable; the frontend makes this fallback unmistakable.
            payload = demo_payload(business, location, radius, concepts, "SerpAPI geçici olarak erişilemedi")
            self.cache_response(cache_key, payload)
            self.send_json(payload)

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

    def render_budget_ok(self):
        now = time.monotonic()
        forwarded_for = self.headers.get("X-Forwarded-For", "").split(",", 1)[0].strip()
        client = forwarded_for or self.client_address[0]
        with CACHE_LOCK:
            history, client_history = RENDER_CALL_LOG["__global__"], RENDER_CALL_LOG[client]
            for entries in (history, client_history):
                while entries and now - entries[0] > RENDER_WINDOW_SECONDS:
                    entries.popleft()
            if len(history) >= MAX_RENDERS_PER_WINDOW or len(client_history) >= MAX_RENDERS_PER_CLIENT:
                return False
            history.append(now)
            client_history.append(now)
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
    def maps_search(business, location, api_key, radius=1000):
        params = {
            "engine": "google_maps",
            "type": "search",
            "q": f"{business} · {location} · {radius} metre çevresi",
            "api_key": api_key,
            "hl": "tr",
            "z": radius_zoom(radius),
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
        # Static frontend assets change with each deployment; revalidate instead
        # of keeping a stale browser copy after an analysis/model update.
        self.send_header("Cache-Control", "no-cache, max-age=0")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Strict-Transport-Security", "max-age=31536000")
        self.send_header("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self' https://neunsivpakcbgvfxvprx.supabase.co; img-src 'self' data:; frame-src https://www.google.com https://maps.google.com")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    port = int(os.environ.get("PORT", "8000"))
    print(f"SerpMe: http://localhost:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), AppHandler).serve_forever()
