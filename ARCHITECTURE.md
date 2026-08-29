# SerpMe Sistem Mimarisi

```mermaid
flowchart LR
  U[Web arayüzü] --> V[İstek doğrulama]
  V --> L[Konum çözümleme]
  L --> S[SerpAPI Google Maps adaptörü]
  S --> R[Ham yerel sonuçlar]
  R --> A[Pazar analiz motoru]
  A --> C[Konsept eşleştirme motoru]
  A --> F[Finansal plan motoru]
  C --> LAY[Konsept Stüdyosu & yerleşim motoru]
  LAY --> V3[Tarayıcıda canlı 3D konsept maketi]
  C --> O[Rapor & öneri katmanı]
  F --> O
  O --> U
  H[Platform sağlık denetimi] --> P[/healthz]
```

## Katmanlar

- **Web arayüzü:** İşletme, detaylı mikro-konum, yarıçap, konsept adayları ve finansal varsayımları toplar.
- **İstek doğrulama:** Boş alanları, koordinat aralığını ve yarıçapı denetler.
- **Konum çözümleme:** İşletme tipi ile mahalle, cadde veya açık adresi tek bir Google Maps sorgusunda birleştirir.
- **SerpAPI adaptörü:** API anahtarını sadece sunucuda `.env` üzerinden kullanır; istemciye asla göndermez.
- **Pazar analiz motoru:** Rakip yoğunluğu, puan, yorum talebi ve açık işletme oranını hesaplar.
- **Konsept eşleştirme motoru:** Her aday için ayrı Google Maps sorgusu yapar; mikro-konum ve kategori eşleşmeyen işletmeleri dışarıda bırakır.
- **Finansal plan motoru:** Kullanıcının kira, sabit gider, sepet ve brüt marj varsayımlarından başa baş hedefini üretir.
- **Dağıtım katmanı:** Docker imajı uygulamayı çalıştırır; platform `GET /healthz` ile hizmet durumunu denetler. `SERPAPI_KEY` üretimde platformun gizli ortam değişkeni olarak tanımlanır.
- **Güvenlik katmanı:** Statik dosya izin listesi `.env` erişimini engeller; IP başına istek sınırı, sabit boyutlu beş dakikalık önbellek ve saatlik SerpAPI çağrı bütçesi anahtarın dolaylı kullanımını sınırlar. Güvenlik başlıkları tarayıcı saldırı yüzeyini sınırlar; konteyner yetkisiz kullanıcı ile çalışır.

## Konsept Stüdyosu, yerleşim ve optimizasyon

Konsept Stüdyosu, pazar analizinden ayrı çalışan bir ön tasarım katmanıdır. Net alan, cephe, konsept, servis modeli, erişilebilirlik tercihi ve konsepte özgü operasyon parametrelerinden düzenlenebilir kat planı üretir. Bu katman ruhsat, yangın veya statik proje yerine geçmez; uygulama projesi öncesindeki karar ve kapasite çalışması içindir.

### Başlangıç yerleşimi

1. Seçilen servis profili; karşılama, servis/mutfak, depo ve dolaşım için başlangıç alan oranlarını tanımlar.
2. Kullanıcının mutfak, depo veya sergileme alanı girdileri varsa bu oranlar ilgili profil varsayımını değiştirir.
3. Konuk/satış alanı, `net alan - sabit operasyon alanları` mantığıyla hesaplanır. Perakendede kullanıcının sergileme alanı tercihi doğrudan kullanılabilir.
4. Eş zamanlı kapasite, konuk/satış alanının konsept profilindeki kişi başına alan varsayımına bölünmesiyle hesaplanır. Günlük kapasite, servis turu veya randevu/oda/istasyon modeline göre türetilir.
5. Alanlar yüzde tabanlı bir plan ızgarasına yerleştirilir. Bu sayede plan, farklı ekranlarda aynı ölçek mantığıyla düzenlenir.

### Kullanıcı kısıtları ve yeniden optimizasyon

Kullanıcı alanları sürükleyebilir; duvar, sabit engel, kapı, lavabo ekleyebilir, biçim-boyut-açı değiştirebilir ve yeni kat oluşturabilir. Her kat bağımsız veri olarak tutulur.

- **Çakışma kontrolü:** “Engellere göre optimize et” komutu, aktif kattaki her fonksiyon alanını duvar, engel ve lavabo ile eksen hizalı dikdörtgen kesişim kontrolünden geçirir.
- **Düzeltme:** Bir kesişme varsa ilgili alan, engelin altına `engel yüksekliği + %3` boşluk bırakacak şekilde taşınır; plan sınırları aşılmaz.
- **Kapasite etkisi:** Aktif kattaki her engel `1,6 m²`, her lavabo `1,4 m²`, her duvar `0,7 m²` dolaşım/işletim cezası üretir. Güncel eş zamanlı kapasite, bu cezanın kişi başına alan varsayımına bölünmesiyle azaltılır. Günlük kapasite de yeni eş zamanlı kapasite oranıyla ölçeklenir.
- **Şeffaflık:** Sonuçta kullanıcıya aktif kat için kapasite ve uygulanan optimizasyon durumu gösterilir. Sistem, kısıt eklenmesini otomatik olarak “daha iyi” kabul etmez.

Bu yöntem hızlı, açıklanabilir bir ön yerleşim optimizasyonudur. Yangın kaçış mesafesi, kolon aksları, tesisat şaftları, yerel erişilebilirlik mevzuatı, taşıyıcı sistem, mutfak havalandırması ve gerçek mobilya ölçüleri için yetkili mimar/uygulama projesi kontrolü gerekir.

### Ücretsiz canlı 3D konsept maketi

Plan onaylandığında tarayıcıdaki Canvas katmanı, aktif katın yüzde tabanlı koordinatlarını izometrik üç boyutlu görünüme çevirir. Zemin, dış/iç duvar, pencere, kapı, lavabo, engel, karşılama-servis birimleri, aydınlatma ve seçilen modele göre masa-sandalye veya raf düzeni çizilir. Bu görüntü plan değiştiğinde anında yeniden çizilir ve dış görsel API’si, gizli anahtar veya kullanıcı kredisi kullanmaz. İki farklı izometrik açı desteklenir.

## SerpAPI parametreleri

- `engine=google_maps`: Google Maps motoru.
- `type=search`: Yerel işletme listesi.
- `q`: İşletme tipi ile mikro-konumu içeren arama metni.
- `hl=tr`: Türkçe Google Maps bağlamı.
- `api_key`: Sadece sunucuda tutulan SerpAPI anahtarı.

## Analiz parametreleri

- **Harita yoğunluğu:** Görünen rakip sayısı, işletme başına yorum ve açık işletme oranı.
- **Karşılaştırma uyumu:** Mikro-konum eşleşmesi, kategori eşleşmesi, puan, yorum hacmi ve Google Maps sırası.
- **Fırsat skoru:** Talep ve kalite boşluğunu artırır; aşırı rekabeti düşürür.
- **Başa baş işlem/adet:** `(kira + sabit gider) / (ortalama sepet × brüt marj)`; aylık sonuç 30 güne bölünür.
- **İşletme sermayesi:** Üç aylık sabit gider tamponu. Vergi, yatırım harcaması, kredi ve amortisman bu MVP’de ayrı ele alınmalıdır.
