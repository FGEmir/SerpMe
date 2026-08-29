window.SerpMeCatalog = {
  categories: [
    {id: 'food', label: 'Yeme · İçme · Eğlence', concepts: [
      {id: 'cafe', label: 'Kafe', search: 'kafe', model: 'cafe', params: [['counterLength','Bar uzunluğu (m)',4,1,20],['avgDwell','Ortalama kalış (dk)',55,15,180],['deliveryShare','Paket servis payı (%)',15,0,80]]},
      {id: 'restaurant', label: 'Restoran', search: 'restoran', model: 'restaurant', params: [['kitchenRatio','Mutfak alanı (%)',28,15,45],['tableTurns','Masa turu / gün',2.2,1,6,.1],['avgParty','Ortalama grup büyüklüğü',2.4,1,10,.1]]},
      {id: 'fast-food', label: 'Fast food', search: 'fast food', model: 'cafe', params: [['serviceSeconds','Sipariş servis süresi (sn)',150,30,600],['pickupShare','Gel-al payı (%)',35,0,100],['deliveryShare','Paket servis payı (%)',35,0,100]]},
      {id: 'nightlife', label: 'Gece hayatı', search: 'bar gece kulübü', model: 'restaurant', params: [['barLength','Bar uzunluğu (m)',6,2,30],['peakHours','Yoğun saat (saat)',5,2,10],['standingShare','Ayakta alan payı (%)',35,0,80]]}
    ]},
    {id: 'retail', label: 'Alışveriş hizmetleri', concepts: [
      {id: 'supermarket', label: 'Süpermarket', search: 'süpermarket', model: 'retail', params: [['skuCount','SKU hedefi',3500,500,20000],['coldShare','Soğuk alan payı (%)',18,0,45],['aisleWidth','Koridor genişliği (m)',1.5,1,3,.1]]},
      {id: 'convenience', label: 'Bakkal / convenience store', search: 'bakkal market', model: 'retail', params: [['skuCount','SKU hedefi',900,100,5000],['walkinShare','Anlık alışveriş payı (%)',75,0,100],['coldShare','Soğuk alan payı (%)',22,0,50]]},
      {id: 'clothing', label: 'Giyim ve aksesuar', search: 'giyim mağazası', model: 'retail', params: [['fittingRooms','Deneme kabini',2,0,12],['displayRatio','Sergileme alanı (%)',58,25,80],['stockTurn','Stok devir / yıl',5,1,18]]},
      {id: 'home-living', label: 'Ev ve yaşam', search: 'ev dekorasyon mağazası', model: 'retail', params: [['displayRatio','Sergileme alanı (%)',52,20,80],['warehouseShare','Depo alanı (%)',24,10,55],['avgBasket','Ortalama sepet (₺)',1800,100,20000]]}
    ]},
    {id: 'care', label: 'Hizmet ve bakım işletmeleri', concepts: [
      {id: 'beauty', label: 'Güzellik ve kişisel bakım', search: 'güzellik salonu', model: 'studio', params: [['treatmentRooms','Uygulama odası',3,1,15],['appointmentMinutes','Randevu süresi (dk)',60,15,240],['stations','Servis istasyonu',4,1,20]]},
      {id: 'accommodation', label: 'Konaklama', search: 'otel pansiyon', model: 'studio', params: [['roomCount','Oda sayısı',12,2,120],['occupancy','Doluluk hedefi (%)',65,10,100],['adr','Günlük oda fiyatı (₺)',3200,300,30000]]},
      {id: 'repair', label: 'Temizlik ve onarım', search: 'tamir bakım servisi', model: 'studio', params: [['workstations','Çalışma istasyonu',4,1,30],['turnaroundDays','Teslim süresi (gün)',3,1,21],['pickupShare','Teslim alma payı (%)',30,0,100]]}
    ]},
    {id: 'professional', label: 'Kurumsal ve profesyonel hizmetler', concepts: [
      {id: 'consulting', label: 'Ofis ve danışmanlık şirketleri', search: 'danışmanlık ofisi', model: 'studio', params: [['workstations','Çalışma istasyonu',12,1,100],['meetingRooms','Toplantı odası',2,0,20],['billableUtilization','Faturalandırılabilir doluluk (%)',68,10,100]]}
    ]}
  ],
  getCategory(id) { return this.categories.find(category => category.id === id) || this.categories[0]; },
  getConcept(id) { return this.categories.flatMap(category => category.concepts).find(concept => concept.id === id) || this.categories[0].concepts[0]; }
};
