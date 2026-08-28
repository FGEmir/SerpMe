# Pazar Pusulası Sistem Mimarisi

```mermaid
flowchart LR
  U[Web arayüzü] --> V[İstek doğrulama]
  V --> L[Konum çözümleme]
  L --> S[SerpAPI Google Maps adaptörü]
  S --> R[Ham yerel sonuçlar]
  R --> A[Pazar analiz motoru]
  A --> C[Konsept eşleştirme motoru]
  A --> F[Finansal plan motoru]
  C --> O[Rapor & öneri katmanı]
  F --> O
  O --> U
  H[Platform sağlık denetimi] --> P[/healthz]
```

## Katmanlar

- **Web arayüzü:** İşletme, mikro-konum, GPS, yarıçap, konsept adayları ve finansal varsayımları toplar.
- **İstek doğrulama:** Boş alanları, koordinat aralığını ve yarıçapı denetler.
- **Konum çözümleme:** GPS verilirse `ll=@latitude,longitude,zoom` ile kesin merkez kullanır; yoksa işletme + açık adres sorgusu üretir.
- **SerpAPI adaptörü:** API anahtarını sadece sunucuda `.env` üzerinden kullanır; istemciye asla göndermez.
- **Pazar analiz motoru:** Rakip yoğunluğu, puan, yorum talebi ve açık işletme oranını hesaplar.
- **Konsept eşleştirme motoru:** Her aday için ayrı Google Maps sorgusu yapar; mikro-konum ve kategori eşleşmeyen işletmeleri dışarıda bırakır.
- **Finansal plan motoru:** Kullanıcının kira, sabit gider, sepet ve brüt marj varsayımlarından başa baş hedefini üretir.
- **Dağıtım katmanı:** Docker imajı uygulamayı çalıştırır; platform `GET /healthz` ile hizmet durumunu denetler. `SERPAPI_KEY` üretimde platformun gizli ortam değişkeni olarak tanımlanır.
- **Güvenlik katmanı:** Statik dosya izin listesi `.env` erişimini engeller; IP başına istek sınırı, sabit boyutlu beş dakikalık önbellek ve saatlik SerpAPI çağrı bütçesi anahtarın dolaylı kullanımını sınırlar. Güvenlik başlıkları tarayıcı saldırı yüzeyini sınırlar; konteyner yetkisiz kullanıcı ile çalışır.

## SerpAPI parametreleri

- `engine=google_maps`: Google Maps motoru.
- `type=search`: Yerel işletme listesi.
- `q`: İşletme tipi ve GPS yoksa mikro-konumu içeren arama metni.
- `ll`: GPS girildiğinde `@enlem,boylam,zoom` biçiminde kesin arama merkezi.
- `hl=tr`: Türkçe Google Maps bağlamı.
- `api_key`: Sadece sunucuda tutulan SerpAPI anahtarı.

## Analiz parametreleri

- **Harita yoğunluğu:** Görünen rakip sayısı, işletme başına yorum ve açık işletme oranı.
- **Karşılaştırma uyumu:** Mikro-konum eşleşmesi, kategori eşleşmesi, puan, yorum hacmi ve Google Maps sırası.
- **Fırsat skoru:** Talep ve kalite boşluğunu artırır; aşırı rekabeti düşürür.
- **Başa baş işlem/adet:** `(kira + sabit gider) / (ortalama sepet × brüt marj)`; aylık sonuç 30 güne bölünür.
- **İşletme sermayesi:** Üç aylık sabit gider tamponu. Vergi, yatırım harcaması, kredi ve amortisman bu MVP’de ayrı ele alınmalıdır.
