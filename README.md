# SerpMe

SerpAPI Google Maps sonuçlarını kullanarak seçilen konumdaki işletme tipinin rekabet ve fırsat analizini çıkaran DevPost projesi.

## Başlatma

Python 3 yeterlidir; ek paket kurulumu gerekmez.

```bash
export SERPAPI_KEY="SerpAPI anahtarınız"
python3 app.py
```

Ardından `http://localhost:8000` adresini açın.

Anahtar eklenmemişse uygulama yine rapor üretir ve açıkça **Demo verisi** etiketi gösterir. Canlı Google Maps sonuçları için kendi anahtarınızı ortam değişkeni olarak tanımlayıp sunucuyu yeniden başlatın.

## Kullanılan SerpAPI parametreleri

| Parametre | Değer | Amaç |
| --- | --- | --- |
| `engine` | `google_maps` | Google Maps arama motoru |
| `type` | `search` | Yerel işletme sonuçları |
| `q` | `{işletme tipi} in {konum}` | Pazar sorgusu |
| `hl` | `tr` | Türkçe sonuç tercihleri |
| `api_key` | ortam değişkeninden | Sunucu tarafında gizli tutulan anahtar |

Fırsat skoru, görünen rakip sayısı, ortalama puan, yorum yoğunluğu ve açık işletme oranını birleştirir. API anahtarı hiçbir zaman tarayıcıya gönderilmez.

## Yoğunluk ve konsept önerisi

Uygulama, her aday konsept için ayrı bir `q={konsept} in {konum}` Google Maps sorgusu yapar (en fazla üç aday). Sonuçlar şu parametrelerle değerlendirilir:

- **Harita yoğunluğu:** Görünen işletme sayısı, işletme başına yorum yoğunluğu ve açık işletme oranı.
- **Talep sinyali:** Toplam ve işletme başına yorum sayısı.
- **Kalite boşluğu:** Ortalama puanın 5 yıldızdan uzaklığı; daha düşük puan, iyileştirilebilir deneyim ihtimalini yükseltir.
- **Fırsat skoru:** Talep ve kalite boşluğunu ödüllendirir; yüksek rekabeti dengeler.

Bu skorlar keşif amaçlıdır; kira, yaya trafiği, demografi ve maliyet gibi saha verileriyle doğrulanmalıdır.

Öne çıkan işletmeler, yalnızca API sırası ile gösterilmez. Uygulama; adresin seçilen konumla eşleşmesi, işletme tipi/kategori eşleşmesi, puan, yorum hacmi ve Google Maps sonuç sırasından oluşan **karşılaştırma uyum skoru** ile temsilî rakipleri seçer.

Konsept sıralaması da aynı filtreyi kullanır: Bir aday konseptin puanı, yalnızca hem mikro-konum hem de kategori eşleşmesi geçen işletmelerden hesaplanır. Her satırdaki örnek işletme adları, bu skorun dayandığı referans setini görünür kılar.

## Sonraki sürüm için yararlı parametreler

- `ll=@enlem,boylam,zoom`: Bir mahalle ya da cadde çevresini kesin olarak taramak için.
- `location` + `z`: Metin konumunu arama başlangıç noktasına çevirmek için; ikisi birlikte kullanılmalıdır.
- `type=place` + `data_id`: Seçilen rakibin telefon, çalışma saati, adres ve ayrıntılarını derinleştirmek için.
- `start`: Bir sonraki sonuç sayfasından devam ederek daha geniş rakip seti toplamak için.
- `no_cache=true`: Çok güncel sonuç gerektiğinde SerpAPI önbelleğini atlamak için.

Google Maps API’de sorguyu şehir/ilçe ile daraltmak, `ll` koordinatlarına güvenmekten daha tutarlı sonuç verebilir; bu MVP bu nedenle işletme tipi ile konumu aynı `q` sorgusunda birleştirir. Ayrıntılar için [resmî SerpAPI Google Maps dokümantasyonu](https://serpapi.com/google-maps-api) incelenebilir.
