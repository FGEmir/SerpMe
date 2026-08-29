window.SerpMeCatalog = {
  categories: [
    {id: 'food', label: 'Food · Beverage · Nightlife', concepts: [
      {id: 'cafe', label: 'Cafe', search: 'cafe', model: 'cafe', params: [['counterLength','Counter length (m)',4,1,20],['avgDwell','Average dwell time (min)',55,15,180],['deliveryShare','Delivery share (%)',15,0,80]]},
      {id: 'restaurant', label: 'Restaurant', search: 'restaurant', model: 'restaurant', params: [['kitchenRatio','Kitchen area (%)',28,15,45],['tableTurns','Table turns / day',2.2,1,6,.1],['avgParty','Average party size',2.4,1,10,.1]]},
      {id: 'fast-food', label: 'Fast food', search: 'fast food', model: 'cafe', params: [['serviceSeconds','Order service time (sec)',150,30,600],['pickupShare','Pickup share (%)',35,0,100],['deliveryShare','Delivery share (%)',35,0,100]]},
      {id: 'nightlife', label: 'Nightlife', search: 'bar nightclub', model: 'restaurant', params: [['barLength','Bar length (m)',6,2,30],['peakHours','Peak hours',5,2,10],['standingShare','Standing area share (%)',35,0,80]]}
    ]},
    {id: 'retail', label: 'Retail services', concepts: [
      {id: 'supermarket', label: 'Supermarket', search: 'supermarket', model: 'retail', params: [['skuCount','SKU target',3500,500,20000],['coldShare','Chilled area share (%)',18,0,45],['aisleWidth','Aisle width (m)',1.5,1,3,.1]]},
      {id: 'convenience', label: 'Convenience store', search: 'convenience store', model: 'retail', params: [['skuCount','SKU target',900,100,5000],['walkinShare','Walk-in purchase share (%)',75,0,100],['coldShare','Chilled area share (%)',22,0,50]]},
      {id: 'clothing', label: 'Clothing & accessories', search: 'clothing store', model: 'retail', params: [['fittingRooms','Fitting rooms',2,0,12],['displayRatio','Display area (%)',58,25,80],['stockTurn','Stock turns / year',5,1,18]]},
      {id: 'home-living', label: 'Home & living', search: 'home decor store', model: 'retail', params: [['displayRatio','Display area (%)',52,20,80],['warehouseShare','Storage area (%)',24,10,55],['avgBasket','Average basket (₺)',1800,100,20000]]}
    ]},
    {id: 'care', label: 'Service & care businesses', concepts: [
      {id: 'beauty', label: 'Beauty & personal care', search: 'beauty salon', model: 'studio', params: [['treatmentRooms','Treatment rooms',3,1,15],['appointmentMinutes','Appointment duration (min)',60,15,240],['stations','Service stations',4,1,20]]},
      {id: 'accommodation', label: 'Accommodation', search: 'hotel', model: 'studio', params: [['roomCount','Room count',12,2,120],['occupancy','Occupancy target (%)',65,10,100],['adr','Daily room rate (₺)',3200,300,30000]]},
      {id: 'repair', label: 'Cleaning & repair', search: 'repair service', model: 'studio', params: [['workstations','Workstations',4,1,30],['turnaroundDays','Turnaround time (days)',3,1,21],['pickupShare','Collection share (%)',30,0,100]]}
    ]},
    {id: 'professional', label: 'Corporate & professional services', concepts: [
      {id: 'consulting', label: 'Office & consulting', search: 'consulting office', model: 'studio', params: [['workstations','Workstations',12,1,100],['meetingRooms','Meeting rooms',2,0,20],['billableUtilization','Billable utilization (%)',68,10,100]]}
    ]}
  ],
  getCategory(id) { return this.categories.find(category => category.id === id) || this.categories[0]; },
  getConcept(id) { return this.categories.flatMap(category => category.concepts).find(concept => concept.id === id) || this.categories[0].concepts[0]; }
};
