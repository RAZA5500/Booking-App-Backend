// Real hotels from around the world. Names, cities and countries are factual;
// everything else — nightly rates, room inventory, ratings, availability — is
// generated demo data for this sample app and is not affiliated with, endorsed
// by, or representative of the actual properties.

const AMENITY_SETS = {
  luxury: ['Free WiFi', 'Spa', 'Fine dining', 'Concierge', 'Fitness centre', 'Room service', 'Valet parking', 'Bar'],
  resort: ['Free WiFi', 'Outdoor pool', 'Private beach', 'Spa', 'Water sports', 'Kids club', 'Multiple restaurants', 'Bar'],
  boutique: ['Free WiFi', 'Boutique bar', 'Curated library', 'Bicycle hire', 'Breakfast included', 'Terrace', 'Pet friendly'],
  city: ['Free WiFi', 'Fitness centre', 'Business centre', 'Rooftop bar', 'Airport shuttle', 'Laundry', 'Meeting rooms'],
  lodge: ['Free WiFi', 'Guided excursions', 'All meals included', 'Fireplace', 'Spa', 'Library', 'Stargazing deck'],
};

const ROOM_TIERS = [
  { key: 'deluxe', name: 'Deluxe Room', multiplier: 1, capacity: 2, beds: '1 king bed', size: 38, count: 8 },
  { key: 'executive', name: 'Executive Suite', multiplier: 1.85, capacity: 3, beds: '1 king + sofa bed', size: 64, count: 4 },
  { key: 'signature', name: 'Signature Suite', multiplier: 3.1, capacity: 4, beds: '2 king beds', size: 120, count: 2 },
];

const ROOM_BLURB = {
  deluxe: 'Generous room with a sitting area, marble bathroom and the property’s signature turndown service.',
  executive: 'A separate living room, upgraded amenities and access to the executive lounge.',
  signature: 'The top of the house: multiple rooms, the best outlook in the building and a dedicated host.',
};

// Picsum seeds give every hotel a stable, distinct set of photographs without
// hotlinking real marketing imagery.
const images = (slug) =>
  ['a', 'b', 'c', 'd', 'e'].map(
    (suffix) => `https://picsum.photos/seed/${slug}-${suffix}/1600/1000`
  );

const hotel = (input) => {
  const {
    slug, name, city, country, continent, category, stars, rating, reviews, price,
    description, highlights, tags = [], featured = false, roomNames = {}, amenities,
  } = input;

  return {
    id: slug,
    slug,
    name,
    city,
    country,
    continent,
    category,
    starRating: stars,
    rating,
    reviewsCount: reviews,
    basePrice: price,
    currency: 'USD',
    description,
    highlights,
    tags,
    featured,
    amenities: amenities || AMENITY_SETS[category] || AMENITY_SETS.luxury,
    images: images(slug),
    policies: {
      checkIn: '15:00',
      checkOut: '11:00',
      cancellation: 'Free cancellation up to 48 hours before check-in.',
      children: 'Children of all ages are welcome.',
    },
    rooms: ROOM_TIERS.map((tier) => ({
      id: `${slug}-${tier.key}`,
      key: tier.key,
      name: roomNames[tier.key] || tier.name,
      description: ROOM_BLURB[tier.key],
      price: Math.round((price * tier.multiplier) / 5) * 5,
      capacity: tier.capacity,
      beds: tier.beds,
      sizeSqm: tier.size,
      count: tier.count,
    })),
    active: true,
    createdAt: new Date().toISOString(),
  };
};

export const HOTELS = [
  // ---------------------------------------------------------------- Europe
  hotel({
    slug: 'ritz-paris', name: 'The Ritz Paris', city: 'Paris', country: 'France',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.9, reviews: 2841, price: 1450,
    featured: true,
    description: 'The definitive Paris grand hotel, facing Place Vendôme since 1898. Gilded salons, a legendary bar and a garden courtyard that feels a world away from the city.',
    highlights: ['Place Vendôme address', 'Ritz Club spa and pool', 'Bar Hemingway'],
    tags: ['Iconic', 'Historic'],
    roomNames: { signature: 'Prestige Suite' },
  }),
  hotel({
    slug: 'claridges-london', name: "Claridge's", city: 'London', country: 'United Kingdom',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.8, reviews: 3120, price: 980,
    featured: true,
    description: 'Art deco grandeur in the heart of Mayfair, and the definition of a London institution. Afternoon tea in the foyer has been a ritual for generations.',
    highlights: ['Mayfair location', 'Art deco interiors', 'Afternoon tea in the foyer'],
    tags: ['Iconic', 'Art deco'],
  }),
  hotel({
    slug: 'hotel-danieli-venice', name: 'Hotel Danieli', city: 'Venice', country: 'Italy',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.7, reviews: 1964, price: 890,
    description: 'A 14th-century palazzo on the Riva degli Schiavoni, steps from St Mark’s Square. The soaring gothic staircase in the lobby is worth the stay on its own.',
    highlights: ['Lagoon-facing terrace', 'Gothic palazzo lobby', 'Walk to St Mark’s'],
    tags: ['Waterfront', 'Historic'],
  }),
  hotel({
    slug: 'hotel-de-russie-rome', name: 'Hotel de Russie', city: 'Rome', country: 'Italy',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.8, reviews: 1503, price: 760,
    description: 'A quiet terraced garden between the Spanish Steps and Piazza del Popolo, with one of the most civilised courtyards in Rome.',
    highlights: ['Secret Garden courtyard', 'Between Popolo and the Steps', 'Stravinskij Bar'],
    tags: ['Garden', 'Central'],
  }),
  hotel({
    slug: 'belmond-caruso-ravello', name: 'Belmond Hotel Caruso', city: 'Ravello', country: 'Italy',
    continent: 'Europe', category: 'resort', stars: 5, rating: 4.9, reviews: 892, price: 1180,
    featured: true,
    description: 'An 11th-century palace 350 metres above the Amalfi Coast, with an infinity pool that appears to spill straight into the Tyrrhenian Sea.',
    highlights: ['Cliff-top infinity pool', 'Amalfi Coast panorama', 'Terraced gardens'],
    tags: ['Clifftop', 'Romantic'],
  }),
  hotel({
    slug: 'hotel-sacher-vienna', name: 'Hotel Sacher Wien', city: 'Vienna', country: 'Austria',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.7, reviews: 2210, price: 620,
    description: 'Opposite the State Opera, home of the original Sachertorte and a red-velvet interior that has barely changed in a century.',
    highlights: ['Opposite the State Opera', 'The original Sachertorte', 'Spa on the top floor'],
    tags: ['Historic', 'Central'],
  }),
  hotel({
    slug: 'adlon-kempinski-berlin', name: 'Hotel Adlon Kempinski', city: 'Berlin', country: 'Germany',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.6, reviews: 2740, price: 540,
    description: 'Beside the Brandenburg Gate, rebuilt to its original 1907 spirit. The rooms at the front look straight down Unter den Linden.',
    highlights: ['Beside the Brandenburg Gate', 'Two-storey spa', 'Unter den Linden views'],
    tags: ['Landmark', 'City centre'],
  }),
  hotel({
    slug: 'badrutts-palace-st-moritz', name: "Badrutt's Palace Hotel", city: 'St. Moritz', country: 'Switzerland',
    continent: 'Europe', category: 'resort', stars: 5, rating: 4.8, reviews: 1105, price: 1290,
    description: 'The alpine original, above the lake at St. Moritz since 1896. Ski in the morning, dine under the turrets at night.',
    highlights: ['Lake and Alps views', 'Ski concierge', 'Historic turreted facade'],
    tags: ['Ski', 'Alpine'],
  }),
  hotel({
    slug: 'hotel-arts-barcelona', name: 'Hotel Arts Barcelona', city: 'Barcelona', country: 'Spain',
    continent: 'Europe', category: 'city', stars: 5, rating: 4.7, reviews: 3480, price: 470,
    description: 'A glass tower on the Barceloneta seafront, with a sculpture-dotted garden and two Michelin-starred kitchens downstairs.',
    highlights: ['Seafront tower', 'Outdoor pool deck', 'Beach in two minutes'],
    tags: ['Beachfront', 'Design'],
  }),
  hotel({
    slug: 'gran-hotel-ingles-madrid', name: 'Gran Hotel Inglés', city: 'Madrid', country: 'Spain',
    continent: 'Europe', category: 'boutique', stars: 5, rating: 4.8, reviews: 940, price: 420,
    description: 'Madrid’s oldest hotel, reopened as a dark, art-deco jewel box in the Literary Quarter.',
    highlights: ['Literary Quarter', 'Art deco restoration', 'Intimate 48 rooms'],
    tags: ['Boutique', 'Art deco'],
  }),
  hotel({
    slug: 'pestana-palace-lisbon', name: 'Pestana Palace Lisboa', city: 'Lisbon', country: 'Portugal',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.7, reviews: 1650, price: 360,
    description: 'A restored 19th-century palace and national monument, set in botanical gardens above the Tagus.',
    highlights: ['National monument', 'Botanical gardens', 'Garden pool'],
    tags: ['Palace', 'Gardens'],
  }),
  hotel({
    slug: 'grand-hotel-stockholm', name: 'Grand Hôtel Stockholm', city: 'Stockholm', country: 'Sweden',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.7, reviews: 2050, price: 510,
    description: 'On the quayside facing the Royal Palace, and the traditional home of Nobel laureates each December.',
    highlights: ['Waterfront at Blasieholmen', 'Nordic spa', 'Royal Palace views'],
    tags: ['Waterfront', 'Historic'],
  }),
  hotel({
    slug: 'the-shelbourne-dublin', name: 'The Shelbourne', city: 'Dublin', country: 'Ireland',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.6, reviews: 2380, price: 390,
    description: 'Facing St Stephen’s Green since 1824, with the most sociable lobby bar in Dublin.',
    highlights: ['On St Stephen’s Green', 'The Horseshoe Bar', 'Georgian architecture'],
    tags: ['Historic', 'City centre'],
  }),
  hotel({
    slug: 'ciragan-palace-istanbul', name: 'Çırağan Palace Kempinski', city: 'Istanbul', country: 'Türkiye',
    continent: 'Europe', category: 'luxury', stars: 5, rating: 4.8, reviews: 2890, price: 680,
    featured: true,
    description: 'A former Ottoman palace on the European shore of the Bosphorus, with an infinity pool at the water’s edge.',
    highlights: ['Bosphorus waterfront', 'Ottoman palace wing', 'Infinity pool'],
    tags: ['Palace', 'Waterfront'],
  }),

  // ------------------------------------------------------------------ Asia
  hotel({
    slug: 'aman-tokyo', name: 'Aman Tokyo', city: 'Tokyo', country: 'Japan',
    continent: 'Asia', category: 'luxury', stars: 5, rating: 4.9, reviews: 1240, price: 1350,
    featured: true,
    description: 'The top six floors of the Otemachi Tower, built around a 30-metre atrium in washi paper and stone. Restraint on a scale you have to stand inside to understand.',
    highlights: ['30-metre paper atrium', 'Skyline onsen-style baths', 'Imperial Palace views'],
    tags: ['Minimalist', 'Skyline'],
    roomNames: { deluxe: 'Deluxe Room', executive: 'Corner Suite', signature: 'Aman Suite' },
  }),
  hotel({
    slug: 'four-seasons-kyoto', name: 'Four Seasons Hotel Kyoto', city: 'Kyoto', country: 'Japan',
    continent: 'Asia', category: 'luxury', stars: 5, rating: 4.9, reviews: 1580, price: 890,
    description: 'Built around an 800-year-old pond garden in the Higashiyama temple district, a short walk from Sanjūsangen-dō.',
    highlights: ['800-year-old pond garden', 'Temple district', 'Tea ceremony house'],
    tags: ['Garden', 'Cultural'],
  }),
  hotel({
    slug: 'marina-bay-sands', name: 'Marina Bay Sands', city: 'Singapore', country: 'Singapore',
    continent: 'Asia', category: 'city', stars: 5, rating: 4.6, reviews: 8940, price: 520,
    featured: true,
    description: 'Three towers under a ship-shaped SkyPark, with the most photographed infinity pool on earth 57 floors up.',
    highlights: ['57th-floor infinity pool', 'SkyPark observation deck', 'Shoppes and casino'],
    tags: ['Landmark', 'Skyline'],
  }),
  hotel({
    slug: 'raffles-singapore', name: 'Raffles Singapore', city: 'Singapore', country: 'Singapore',
    continent: 'Asia', category: 'luxury', stars: 5, rating: 4.8, reviews: 4120, price: 940,
    description: 'Colonial-era arcades, teak verandas and an all-suite floorplan. The Singapore Sling was invented at the Long Bar here.',
    highlights: ['All-suite property', 'The Long Bar', 'Tropical courtyards'],
    tags: ['Historic', 'All-suite'],
  }),
  hotel({
    slug: 'peninsula-hong-kong', name: 'The Peninsula Hong Kong', city: 'Hong Kong', country: 'Hong Kong SAR',
    continent: 'Asia', category: 'luxury', stars: 5, rating: 4.8, reviews: 3760, price: 780,
    description: 'The grande dame of Kowloon since 1928, looking across the harbour at the Island skyline. The fleet of green Rolls-Royces is part of the furniture.',
    highlights: ['Victoria Harbour views', 'Rooftop helipad', 'Roman-style pool'],
    tags: ['Harbour', 'Iconic'],
  }),
  hotel({
    slug: 'mandarin-oriental-bangkok', name: 'Mandarin Oriental Bangkok', city: 'Bangkok', country: 'Thailand',
    continent: 'Asia', category: 'luxury', stars: 5, rating: 4.9, reviews: 3210, price: 560,
    description: 'On the Chao Phraya since 1876, with a riverside terrace, a shuttle boat and a spa in a teak house across the water.',
    highlights: ['Chao Phraya riverfront', 'Authors’ Wing', 'Riverside spa by boat'],
    tags: ['Riverside', 'Historic'],
  }),
  hotel({
    slug: 'oberoi-udaivilas', name: 'The Oberoi Udaivilas', city: 'Udaipur', country: 'India',
    continent: 'Asia', category: 'resort', stars: 5, rating: 4.9, reviews: 2140, price: 720,
    featured: true,
    description: 'A palace-style resort on the banks of Lake Pichola, with domed pavilions, reflecting pools and semi-private pools off many rooms.',
    highlights: ['Lake Pichola frontage', 'Domed pavilions', 'Private pool rooms'],
    tags: ['Palace', 'Lakefront'],
  }),
  hotel({
    slug: 'taj-mahal-palace-mumbai', name: 'The Taj Mahal Palace', city: 'Mumbai', country: 'India',
    continent: 'Asia', category: 'luxury', stars: 5, rating: 4.8, reviews: 5430, price: 400,
    description: 'Mumbai’s most recognisable building, beside the Gateway of India and open since 1903.',
    highlights: ['Beside the Gateway of India', 'Sea-facing rooms', 'Heritage wing'],
    tags: ['Iconic', 'Seafront'],
  }),
  hotel({
    slug: 'amankila-bali', name: 'Amankila', city: 'Bali', country: 'Indonesia',
    continent: 'Asia', category: 'resort', stars: 5, rating: 4.9, reviews: 860, price: 980,
    description: 'Free-standing thatched suites down a hillside in east Bali, above a three-tiered pool that steps toward the Lombok Strait.',
    highlights: ['Three-tiered cliff pool', 'Private beach club', 'Free-standing suites'],
    tags: ['Clifftop', 'Secluded'],
  }),
  hotel({
    slug: 'ritz-carlton-shanghai', name: 'The Ritz-Carlton Shanghai, Pudong', city: 'Shanghai', country: 'China',
    continent: 'Asia', category: 'city', stars: 5, rating: 4.7, reviews: 2960, price: 430,
    description: 'An art-deco tower in Lujiazui with floor-to-ceiling views across the river to the Bund.',
    highlights: ['Bund skyline views', 'Flair rooftop bar', 'Art deco tower'],
    tags: ['Skyline', 'Business'],
  }),
  hotel({
    slug: 'soneva-fushi-maldives', name: 'Soneva Fushi', city: 'Baa Atoll', country: 'Maldives',
    continent: 'Asia', category: 'resort', stars: 5, rating: 4.9, reviews: 1420, price: 1680,
    featured: true,
    description: 'Barefoot villas hidden in dense jungle on a Baa Atoll island, with an open-air cinema and an observatory.',
    highlights: ['Private beach villas', 'Outdoor cinema', 'UNESCO biosphere reserve'],
    tags: ['Overwater', 'Barefoot luxury'],
  }),

  // ---------------------------------------------------------- Middle East
  hotel({
    slug: 'burj-al-arab-dubai', name: 'Burj Al Arab Jumeirah', city: 'Dubai', country: 'United Arab Emirates',
    continent: 'Middle East', category: 'luxury', stars: 5, rating: 4.8, reviews: 6210, price: 1890,
    featured: true,
    description: 'The sail-shaped tower on its own island, all duplex suites, gold leaf and a helipad 210 metres up.',
    highlights: ['All-duplex suites', 'Private island causeway', 'Butler on every floor'],
    tags: ['Iconic', 'Beachfront'],
    roomNames: { deluxe: 'Deluxe One-Bedroom Suite', executive: 'Panoramic Suite', signature: 'Royal Suite' },
  }),
  hotel({
    slug: 'atlantis-the-royal-dubai', name: 'Atlantis The Royal', city: 'Dubai', country: 'United Arab Emirates',
    continent: 'Middle East', category: 'resort', stars: 5, rating: 4.7, reviews: 4870, price: 860,
    description: 'A stacked-block skyline on Palm Jumeirah with 17 pools, a sky-high infinity edge and a roster of celebrity kitchens.',
    highlights: ['17 pools', 'Palm Jumeirah address', 'Celebrity restaurants'],
    tags: ['Resort', 'Family'],
  }),
  hotel({
    slug: 'ritz-carlton-doha', name: 'The Ritz-Carlton Doha', city: 'Doha', country: 'Qatar',
    continent: 'Middle East', category: 'luxury', stars: 5, rating: 4.6, reviews: 2310, price: 420,
    description: 'On its own marina peninsula in West Bay, with a private beach and a long lagoon pool.',
    highlights: ['Private marina', 'Lagoon pool', 'West Bay skyline'],
    tags: ['Marina', 'Business'],
  }),

  // ---------------------------------------------------------------- Africa
  hotel({
    slug: 'la-mamounia-marrakech', name: 'La Mamounia', city: 'Marrakech', country: 'Morocco',
    continent: 'Africa', category: 'luxury', stars: 5, rating: 4.8, reviews: 3040, price: 650,
    featured: true,
    description: 'Twelve hectares of centuries-old walled gardens inside the medina ramparts, with zellige courtyards and orange groves.',
    highlights: ['Historic walled gardens', 'Four restaurants', 'Moorish spa'],
    tags: ['Gardens', 'Historic'],
  }),
  hotel({
    slug: 'singita-sasakwa-serengeti', name: 'Singita Sasakwa Lodge', city: 'Serengeti', country: 'Tanzania',
    continent: 'Africa', category: 'lodge', stars: 5, rating: 4.9, reviews: 640, price: 2100,
    description: 'An Edwardian-style manor on a hilltop above the Serengeti plains, with each cottage looking over the migration route.',
    highlights: ['Private game reserve', 'Twice-daily game drives', 'Infinity pool over the plains'],
    tags: ['Safari', 'All-inclusive'],
  }),
  hotel({
    slug: 'one-and-only-cape-town', name: 'One&Only Cape Town', city: 'Cape Town', country: 'South Africa',
    continent: 'Africa', category: 'resort', stars: 5, rating: 4.7, reviews: 2680, price: 480,
    description: 'On a private island in the V&A Waterfront marina, with Table Mountain filling the window.',
    highlights: ['Table Mountain views', 'Island spa', 'V&A Waterfront'],
    tags: ['Waterfront', 'City'],
  }),
  hotel({
    slug: 'old-cataract-aswan', name: 'Sofitel Legend Old Cataract', city: 'Aswan', country: 'Egypt',
    continent: 'Africa', category: 'luxury', stars: 5, rating: 4.8, reviews: 1890, price: 380,
    description: 'A Victorian palace on a granite bluff above the Nile, looking across to Elephantine Island and the desert beyond.',
    highlights: ['Nile-facing terrace', 'Victorian palace wing', 'Felucca jetty'],
    tags: ['Riverside', 'Historic'],
  }),

  // -------------------------------------------------------- North America
  hotel({
    slug: 'the-plaza-new-york', name: 'The Plaza', city: 'New York', country: 'United States',
    continent: 'North America', category: 'luxury', stars: 5, rating: 4.6, reviews: 5620, price: 890,
    featured: true,
    description: 'The French château on the corner of Central Park and Fifth Avenue, open since 1907 and still the address people picture when they picture New York.',
    highlights: ['Central Park frontage', 'The Palm Court', 'Fifth Avenue address'],
    tags: ['Iconic', 'Park view'],
  }),
  hotel({
    slug: 'beverly-hills-hotel', name: 'The Beverly Hills Hotel', city: 'Los Angeles', country: 'United States',
    continent: 'North America', category: 'luxury', stars: 5, rating: 4.7, reviews: 3180, price: 950,
    description: 'The Pink Palace on Sunset Boulevard, with banana-leaf wallpaper, private bungalows and the Polo Lounge.',
    highlights: ['Garden bungalows', 'The Polo Lounge', 'Sunset Boulevard'],
    tags: ['Iconic', 'Bungalows'],
  }),
  hotel({
    slug: 'fairmont-banff-springs', name: 'Fairmont Banff Springs', city: 'Banff', country: 'Canada',
    continent: 'North America', category: 'resort', stars: 4, rating: 4.7, reviews: 6840, price: 420,
    description: 'A Scottish baronial castle in the Canadian Rockies, ringed by peaks and a championship golf course.',
    highlights: ['Rocky Mountain setting', 'Willow Stream spa', 'Castle architecture'],
    tags: ['Mountain', 'Family'],
  }),
  hotel({
    slug: 'rosewood-mayakoba', name: 'Rosewood Mayakoba', city: 'Riviera Maya', country: 'Mexico',
    continent: 'North America', category: 'resort', stars: 5, rating: 4.9, reviews: 2410, price: 790,
    description: 'Lagoon suites reached by boat through mangrove canals, each with a private plunge pool and rooftop deck.',
    highlights: ['Arrive by boat', 'Private plunge pools', 'Spa on its own island'],
    tags: ['Lagoon', 'Romantic'],
  }),
  hotel({
    slug: 'fontainebleau-miami', name: 'Fontainebleau Miami Beach', city: 'Miami', country: 'United States',
    continent: 'North America', category: 'resort', stars: 4, rating: 4.4, reviews: 9120, price: 380,
    description: 'The curved mid-century landmark on Collins Avenue, with a pool scene that has been going since 1954.',
    highlights: ['Oceanfront pools', 'Mid-century landmark', 'LIV nightclub'],
    tags: ['Beachfront', 'Nightlife'],
  }),

  // -------------------------------------------------------- South America
  hotel({
    slug: 'copacabana-palace-rio', name: 'Belmond Copacabana Palace', city: 'Rio de Janeiro', country: 'Brazil',
    continent: 'South America', category: 'luxury', stars: 5, rating: 4.8, reviews: 3420, price: 620,
    featured: true,
    description: 'The white art-deco facade that has faced Copacabana beach since 1923, with the most famous hotel pool in Brazil behind it.',
    highlights: ['Copacabana beachfront', 'Art deco landmark', 'Olympic-length pool'],
    tags: ['Beachfront', 'Iconic'],
  }),
  hotel({
    slug: 'alvear-palace-buenos-aires', name: 'Alvear Palace Hotel', city: 'Buenos Aires', country: 'Argentina',
    continent: 'South America', category: 'luxury', stars: 5, rating: 4.7, reviews: 1970, price: 340,
    description: 'French empire style in Recoleta, with Limoges porcelain, a winter garden and the city’s most formal afternoon tea.',
    highlights: ['Recoleta address', 'Belle époque interiors', 'Winter garden tea'],
    tags: ['Historic', 'City centre'],
  }),
  hotel({
    slug: 'explora-patagonia', name: 'Explora Patagonia', city: 'Torres del Paine', country: 'Chile',
    continent: 'South America', category: 'lodge', stars: 5, rating: 4.8, reviews: 720, price: 1150,
    description: 'A white lodge alone on the shore of Lake Pehoé, with the Paine massif filling every window and guided treks included.',
    highlights: ['Guided treks included', 'Lake Pehoé shore', 'All meals included'],
    tags: ['Adventure', 'All-inclusive'],
  }),
  hotel({
    slug: 'belmond-monasterio-cusco', name: 'Belmond Hotel Monasterio', city: 'Cusco', country: 'Peru',
    continent: 'South America', category: 'boutique', stars: 5, rating: 4.8, reviews: 1640, price: 390,
    description: 'A 1592 monastery around a cloistered courtyard, with oxygen-enriched rooms to soften the 3,400-metre altitude.',
    highlights: ['16th-century monastery', 'Oxygen-enriched rooms', 'Cloister courtyard'],
    tags: ['Historic', 'Andes'],
  }),

  // --------------------------------------------------------------- Oceania
  hotel({
    slug: 'park-hyatt-sydney', name: 'Park Hyatt Sydney', city: 'Sydney', country: 'Australia',
    continent: 'Oceania', category: 'luxury', stars: 5, rating: 4.8, reviews: 2540, price: 880,
    featured: true,
    description: 'Low and curved along Campbell’s Cove, directly opposite the Opera House with the Harbour Bridge overhead.',
    highlights: ['Opera House views', 'Rooftop pool', 'The Rocks location'],
    tags: ['Harbour', 'Iconic'],
  }),
  hotel({
    slug: 'qualia-hamilton-island', name: 'qualia', city: 'Hamilton Island', country: 'Australia',
    continent: 'Oceania', category: 'resort', stars: 5, rating: 4.9, reviews: 980, price: 1050,
    description: 'Adults-only pavilions on the northern tip of Hamilton Island, looking over the Coral Sea toward the Whitsundays.',
    highlights: ['Adults only', 'Great Barrier Reef access', 'Private pavilion decks'],
    tags: ['Island', 'Adults only'],
  }),
  hotel({
    slug: 'huka-lodge-taupo', name: 'Huka Lodge', city: 'Taupō', country: 'New Zealand',
    continent: 'Oceania', category: 'lodge', stars: 5, rating: 4.9, reviews: 810, price: 1240,
    description: 'On the banks of the Waikato River just above Huka Falls, where dinner is served anywhere on the lawn you like.',
    highlights: ['Riverside lawns', 'Dinner anywhere on the estate', 'Fly fishing'],
    tags: ['Lodge', 'Nature'],
  }),
];

export const CONTINENTS = [...new Set(HOTELS.map((h) => h.continent))].sort();
export const COUNTRIES = [...new Set(HOTELS.map((h) => h.country))].sort();
export const CATEGORIES = [...new Set(HOTELS.map((h) => h.category))].sort();
export const ALL_AMENITIES = [...new Set(HOTELS.flatMap((h) => h.amenities))].sort();
