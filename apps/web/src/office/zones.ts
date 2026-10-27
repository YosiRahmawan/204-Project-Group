// The eight zones of the isometric floor plan. Coordinates are in the 1376 × 768 space of
// assets/runtime/maps/office-iso.jpg.
export type Zone = {
  id: string;
  // Short name and one-line note for the zone buttons under the map.
  label: string;
  note: string;
  tag: string;
  name: string;
  subtitle: string;
  capacity: string;
  area: string;
  acoustic: string;
  status: string;
  desc: string;
  amenities: string[];
  // Clickable outline of the zone on the map, and where its pin sits.
  points: string;
  pin: readonly [number, number];
};

export const zones: Zone[] = [
  {
    id: 'lobby',
    label: 'Lobby',
    note: 'Welcome to 204.',
    tag: 'ZONE 01',
    name: 'Lobby & Main Entrance',
    subtitle:
      'Grand double-door entrance with reception concierge and guest lounge',
    capacity: '12 Guests',
    area: '92 m²',
    acoustic: 'Ambient Welcome',
    status: 'Open 24/7',
    desc: 'Symmetric reception entrance featuring a sleek marble reception counter, comfortable flanking guest couches with coffee tables, lush interior palm planters, and a welcoming grand entryway connected to the central workspace with open architectural portals.',
    amenities: [
      'Concierge Check-in Desk with attendant terminal',
      'Dual VIP lounge seating areas with plush sofas',
      'Open minimalist architectural portals & security scanners',
      'Architectural light wall backdrop',
    ],
    points:
      '422,504 595,504 602,555 776,555 778,504 918,504 928,680 770,680 770,758 600,758 600,680 415,680',
    pin: [668, 620],
  },
  {
    id: 'workspace',
    label: 'Main Workspace',
    note: 'Create • collaborate • grow',
    tag: 'ZONE 02',
    name: 'Main Workspace Hub',
    subtitle: 'Central open-plan creative & engineering workstation clusters',
    capacity: '32 Workstations',
    area: '185 m²',
    acoustic: 'Quiet Focus Zone',
    status: 'Occupied (85%)',
    desc: 'The vibrant heart of 204 Project Group. Arranged in neat desk pods featuring pixel-perfect monitors, ergonomic seating, central plant dividers, and hardwood flooring providing warmth and visual balance.',
    amenities: [
      'High-speed fiber network drops per pod',
      'Dual-screen ergonomic monitor setups',
      'Central living ficus planter boxes for natural privacy',
      'Direct sightlines into courtyard garden and pool',
    ],
    points: '472,284 868,284 868,498 472,498',
    pin: [670, 390],
  },
  {
    id: 'approval',
    label: 'Approval Room',
    note: 'Meeting & review',
    tag: 'ZONE 03',
    name: 'Approval & Review Boardroom',
    subtitle: 'Formal executive glass conference hall for reviews and pitches',
    capacity: '14 Seats',
    area: '68 m²',
    acoustic: 'Soundproof Glass',
    status: 'Available',
    desc: 'Framed by crisp white partition divider walls, this conference space features a generous boardroom table, executive leather chairs, a presentation whiteboard wall, and custom architectural wall niches.',
    amenities: [
      '4K Video-conference suite and presentation board',
      'Executive high-back ergonomic leather chairs',
      'Integrated tabletop power & HDMI hubs',
      'Open acoustic gateway with perimeter buffering',
    ],
    points: '880,320 1195,320 1195,498 880,498',
    pin: [1040, 410],
  },
  {
    id: 'command',
    label: 'Command Room',
    note: 'Owner dashboard',
    tag: 'ZONE 04',
    name: 'Command Room (Operations Dashboard)',
    subtitle:
      'High-tech monitoring center with panoramic curved multi-screen desk',
    capacity: '6 Operators',
    area: '56 m²',
    acoustic: 'Restricted Audio',
    status: 'Authorized Only',
    desc: 'Specialized mission-control suite equipped with a curved operator console, wraparound multiscreen displays, an ultra-wide wall dashboard monitor, and private archive library shelving.',
    amenities: [
      'Wraparound 180° multi-monitor operations console',
      'Wall-mounted real-time metrics dashboard',
      'Biometric security clearance reader',
      'Dedicated redundant server link',
    ],
    points: '895,510 1230,510 1260,740 920,740',
    pin: [1060, 625],
  },
  {
    id: 'mushola',
    label: 'Mushola',
    note: 'Prayer room',
    tag: 'ZONE 05',
    name: 'Mushola (Prayer Sanctuary)',
    subtitle: 'Serene, contemplative prayer hall with ornate arched mihrab',
    capacity: '10 Persons',
    area: '48 m²',
    acoustic: 'Whisper Quiet',
    status: 'Quiet Sanctuary',
    desc: 'Quietly tucked in the upper-left wing, the prayer room features rich emerald-green patterned prayer rugs, arched Islamic architectural motifs, warm backlighting, and an adjacent wudhu ablution facility.',
    amenities: [
      'Ornate emerald velvet prayer carpets with directional alignments',
      'Traditional arched Mihrab niche with soft ambient backlighting',
      'Clean private ablution (wudhu) washroom attached',
      'Dedicated shoe racks and Quran reading stands',
    ],
    points: '285,170 470,170 470,390 285,390',
    pin: [380, 275],
  },
  {
    id: 'lounge',
    label: 'Break Lounge',
    note: 'Rest & recharge',
    tag: 'ZONE 06',
    name: 'Break Lounge & Pantry Bar',
    subtitle: 'Comfortable social breakout space with couches and espresso bar',
    capacity: '16 Persons',
    area: '74 m²',
    acoustic: 'Casual Social',
    status: 'Open All Day',
    desc: 'Relaxation lounge designed for team bonding and informal coffee chats. Fitted with a massive sectional sofa, rounded twin coffee tables, and a full breakfast barista counter with stools.',
    amenities: [
      'Commercial espresso bar and beverage taps',
      'Deep sectional modular sofa with wool cushions',
      'Bar counter with high-top wooden stools',
      'Seamless open entry portal with courtyard views',
    ],
    points: '148,395 450,395 440,645 130,645',
    pin: [290, 520],
  },
  {
    id: 'garden',
    label: 'Garden',
    note: 'A moment to breathe',
    tag: 'ZONE 07',
    name: 'Courtyard Zen Garden',
    subtitle:
      'Lush landscaped open-air central courtyard with ancient shade tree',
    capacity: '20 Persons',
    area: '130 m²',
    acoustic: 'Natural Ambience',
    status: 'Open Courtyard',
    desc: 'An inspiring open-air sanctuary located between the workspace and the outdoor zones. Anchored by a majestic pixel canopy tree, flagstone walking paths, lush turf lawn, and warm bollard lantern lighting.',
    amenities: [
      'Mature focal shade tree on raised stone planter',
      'Natural flagstone stepping-stone pathways',
      'Living canopy breeze simulation with warm lantern glow',
      'Ambient LED night bollard lanterns',
    ],
    points: '435,50 855,50 870,270 460,270',
    pin: [650, 155],
  },
  {
    id: 'pool',
    label: 'Pool Area',
    note: 'Relax & refresh',
    tag: 'ZONE 08',
    name: 'Resort Pool & Jacuzzi Deck',
    subtitle:
      'Luxury outdoor recreational pool deck with sun loungers and spa pool',
    capacity: '18 Persons',
    area: '115 m²',
    acoustic: 'Outdoor Leisure',
    status: 'Heated & Open',
    desc: 'The defining leisure amenity of the office. Features a mosaic turquoise swimming pool, an elevated bubbling hydromassage jacuzzi, wooden teak sun decks, animated water caustics, and interactive particle splash canvas.',
    amenities: [
      'Full-size heated mosaic swimming pool with submerged steps',
      'Elevated hydrotherapy spa jacuzzi pool with rising bubbles',
      'High-performance interactive ripple & droplet particle splash engine',
      'Teak sundeck with padded reclining loungers & parasols',
    ],
    points: '850,55 1255,55 1265,305 850,305',
    pin: [1055, 175],
  },
];
