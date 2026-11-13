const TYPOS: Record<string, string> = {
  chapathi: 'chapati',
  chappati: 'chapati',
  chappathi: 'chapati',
  maggie: 'maggi',
  maggy: 'maggi',
  magie: 'maggi',
  sabji: 'sabzi',
  subzi: 'sabzi',
  subji: 'sabzi',
  daal: 'dal',
  dhal: 'dal',
  daahl: 'dal',
  bhatura: 'bhature',
  batura: 'bhature',
  bhaturas: 'bhature',
  pratha: 'paratha',
  parathas: 'paratha',
  biriyani: 'biryani',
  briyani: 'biryani',
  biryaani: 'biryani',
  sambhar: 'sambar',
  samber: 'sambar',
  panir: 'paneer',
  pannir: 'paneer',
  idly: 'idli',
  idlee: 'idli',
  idlis: 'idli',
  dosai: 'dosa',
  dosha: 'dosa',
  dosas: 'dosa',
  bhurjee: 'bhurji',
  burji: 'bhurji',
  pohay: 'poha',
  pohe: 'poha',
  rajmah: 'rajma',
  chaval: 'chawal',
  chaawal: 'chawal',
  ande: 'anda',
  anday: 'anda',
  jilebi: 'jalebi',
  jelebi: 'jalebi',
  pakodas: 'pakora',
  wada: 'vada',
  wadas: 'vada',
  omlet: 'omelette',
  omelet: 'omelette',
  omlette: 'omelette',
  nan: 'naan',
  fulka: 'phulka',
  phulkas: 'phulka',
  rotis: 'roti',
  rotli: 'roti',
  chapatis: 'chapati',
  samosas: 'samosa',
  puris: 'puri',
  lasi: 'lassi',
  chass: 'chaas',
  choley: 'chole',
  chhola: 'chole',
  chhole: 'chole',
}

/** Lowercase, strip punctuation, and fix spellings people actually type. */
export function normalize(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s./+&]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  return cleaned
    .split(' ')
    .map((word) => TYPOS[word] ?? word)
    .join(' ')
}

export function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
