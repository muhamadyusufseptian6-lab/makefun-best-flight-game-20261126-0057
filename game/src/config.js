// Petir Courier — config: world layout, islands, runways, missions, tuning.
// All numbers are the game's own design: 9 islands, 3 named missions, 7 rings.
export const WORLD = {
  width: 3840,
  height: 2560,
  seed: 20261126,
  viewWidth: 1280,
  viewHeight: 720,
};

export const PLANE = {
  maxSpeed: 420,      // px per second at full throttle
  minSpeed: 55,
  stallSpeed: 95,
  maxBank: 0.95,      // radians of visual bank
  climbRate: 620,     // ft per second at full pitch
  maxAltitude: 4200,
  fuelCapacity: 100,
  fuelBurnIdle: 0.12, // per second
  fuelBurnFull: 0.55, // per second at full throttle
  hullMax: 100,
  turnAuthority: 1.15,
};

// Islands: x, y, radii, peak height in feet, name, town?
export const ISLANDS = [
  { x: 700,  y: 1900, rx: 430, ry: 300, peak: 900,  name: 'PULAU PETIR',  town: true },
  { x: 1500, y: 900,  rx: 380, ry: 280, peak: 1150, name: 'PULAU KARANG', town: true },
  { x: 3200, y: 600,  rx: 470, ry: 320, peak: 1650, name: 'PULAU BADAI',  town: true },
  { x: 2600, y: 1800, rx: 260, ry: 200, peak: 700,  name: 'PULAU OMBAK',  town: false },
  { x: 3350, y: 1950, rx: 220, ry: 180, peak: 600,  name: 'PULAU KECIL',  town: false },
  { x: 900,  y: 480,  rx: 250, ry: 190, peak: 820,  name: 'PULAU ANGIN',  town: false },
  { x: 2150, y: 380,  rx: 200, ry: 160, peak: 520,  name: 'PULAU SUNYI',  town: false },
  { x: 300,  y: 1150, rx: 210, ry: 170, peak: 660,  name: 'PULAU KABUT',  town: false },
  { x: 1850, y: 2250, rx: 290, ry: 210, peak: 780,  name: 'PULAU SENJA',  town: true },
];

// Runways: center, heading in radians (0 = east), length, width, island index.
export const RUNWAYS = [
  { id: 'petir',  x: 720,  y: 2090, heading: 0,            length: 430, width: 48, label: 'RWY PETIR 09' },
  { id: 'karang', x: 1500, y: 1030, heading: 0,            length: 390, width: 46, label: 'RWY KARANG 09' },
  { id: 'badai',  x: 3200, y: 730,  heading: Math.PI / 2,  length: 410, width: 46, label: 'RWY BADAI 18' },
];

// Fuel depots: fly low (under 250 ft) and slow (under 160) over one to refuel.
export const DEPOTS = [
  { x: 1120, y: 1780, label: 'DEPOT PETIR' },
  { x: 1760, y: 1080, label: 'DEPOT KARANG' },
];

// The seven storm rings of mission 2: x, y, altitude band center (ft).
export const RINGS = [
  { x: 1150, y: 1500, alt: 1200 },
  { x: 1750, y: 1350, alt: 1800 },
  { x: 2350, y: 1100, alt: 2400 },
  { x: 2850, y: 900,  alt: 1500 },
  { x: 3050, y: 1400, alt: 2600 },
  { x: 2650, y: 1950, alt: 1000 },
  { x: 2100, y: 2050, alt: 2000 },
];

// Missions: each is a list of objectives. Types: takeoff, ring, flyto, refuel, land.
export const MISSIONS = [
  {
    id: 1,
    name: 'MISI 1 — PAKET KILAT',
    title: 'Paket Kilat ke Pulau Karang',
    briefing: 'Amplop berisi resep sambal Bu Lastri harus sampai ke Pulau Karang sebelum makan siang. Lepas landas, lewati cincin pemanasan, lalu mendarat manis di RWY Karang.',
    objectives: [
      { type: 'takeoff', text: 'Lepas landas dari RWY Petir (naik di atas 300 ft)' },
      { type: 'ring', ring: 0, text: 'Terbang lewat Cincin Pemanasan (1.200 ft)' },
      { type: 'land', runway: 'karang', text: 'Mendarat di RWY Karang — pelan & lurus' },
    ],
  },
  {
    id: 2,
    name: 'MISI 2 — TUJUH CINCIN PETIR',
    title: 'Tujuh Cincin Petir',
    briefing: 'Tujuh cincin badai menyala di atas kepulauan. Lewati semuanya, di ketinggian yang pas. Satu cincin terlewat, paketnya batal — dan Bu Lastri tidak suka paket batal.',
    objectives: RINGS.map((r, i) => ({
      type: 'ring', ring: i,
      text: `Cincin ${i + 1} dari 7 — ${r.alt.toLocaleString('en-US')} ft`,
    })),
  },
  {
    id: 3,
    name: 'MISI 3 — BADAI TERAKHIR',
    title: 'Badai Terakhir',
    briefing: 'Paket terakhir: surat cinta Pak RT untuk istrinya di Pulau Badai, 34 tahun menikah dan baru berani nulis sekarang. Angin kencang, bahan bakar pas-pasan — isi dulu di Depot Karang, lalu mendarat di RWY Badai.',
    objectives: [
      { type: 'refuel', text: 'Isi bahan bakar di Depot Karang (terbang rendah & pelan)' },
      { type: 'flyto', x: 3200, y: 600, text: 'Terbang ke Pulau Badai menembus angin' },
      { type: 'land', runway: 'badai', text: 'Mendarat di RWY Badai — angin dari samping!' },
    ],
  },
];

export const SCORES = {
  objective: 100,
  ring: 150,
  landingPerfect: 250,
  landingGood: 150,
  landingRough: 60,
  timeBonusPerSecond: 2,
  fuelBonusPerUnit: 3,
};

export const COLORS = {
  skyTop: '#0b2a5b',
  skyMid: '#14608f',
  seaDeep: '#0a3d66',
  seaShallow: '#1b7f8e',
  sand: '#e8d29a',
  grass: '#4d9a4d',
  forest: '#2c6e35',
  townRoof: '#d95f4b',
  runway: '#3a3f46',
  runwayLine: '#f5d76e',
  hudPanel: 'rgba(6, 20, 38, 0.72)',
  hudAmber: '#ffb52e',
  hudCyan: '#37e0ff',
  hudGreen: '#7dff5e',
  hudRed: '#ff5a4e',
  hudWhite: '#f2f7ff',
};
