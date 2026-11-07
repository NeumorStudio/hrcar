// Modelos por marca para las sugerencias del alta (y para separar modelo y versión en los enlaces de coches.net).
// Lo más vendido de segunda mano en España; el formulario añade además los modelos que ya hay en el inventario.
export const MODELOS = {
  Abarth: ['124 Spider', '500', '500C', '595', '695', 'Grande Punto', 'Punto'],
  'Alfa Romeo': ['147', '156', '159', 'Brera', 'Giulia', 'Giulietta', 'GT', 'Junior', 'MiTo', 'Stelvio', 'Tonale'],
  Audi: ['A1', 'A3', 'A4', 'A4 Allroad', 'A5', 'A6', 'A6 Allroad', 'A7', 'A8', 'e-tron', 'e-tron GT', 'Q2', 'Q3', 'Q3 Sportback', 'Q4 e-tron', 'Q5', 'Q5 Sportback', 'Q7', 'Q8', 'R8', 'RS3', 'RS4', 'RS6', 'S3', 'TT'],
  BMW: ['i3', 'i4', 'i5', 'i7', 'iX', 'iX1', 'iX3', 'M2', 'M3', 'M4', 'M5', 'Serie 1', 'Serie 2', 'Serie 2 Active Tourer', 'Serie 2 Gran Coupé', 'Serie 2 Gran Tourer', 'Serie 3', 'Serie 4', 'Serie 5', 'Serie 6', 'Serie 7', 'Serie 8', 'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'Z4'],
  BYD: ['Atto 2', 'Atto 3', 'Dolphin', 'Dolphin Surf', 'Han', 'Seal', 'Seal U', 'Seal U DM-i', 'Tang'],
  'Citroën': ['Berlingo', 'C-Elysée', 'C1', 'C3', 'C3 Aircross', 'C3 Picasso', 'C4', 'C4 Cactus', 'C4 Grand Picasso', 'C4 Picasso', 'C4 SpaceTourer', 'C4 X', 'C5', 'C5 Aircross', 'C5 X', 'DS3', 'DS4', 'Jumper', 'Jumpy', 'Nemo', 'SpaceTourer', 'Xsara Picasso'],
  Cupra: ['Ateca', 'Born', 'Formentor', 'Leon', 'Leon Sportstourer', 'Tavascan', 'Terramar'],
  Dacia: ['Bigster', 'Dokker', 'Duster', 'Jogger', 'Lodgy', 'Logan', 'Sandero', 'Sandero Stepway', 'Spring'],
  DS: ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 5', 'DS 7', 'DS 7 Crossback', 'DS 9'],
  Fiat: ['124 Spider', '500', '500C', '500L', '500X', 'Bravo', 'Doblò', 'Ducato', 'Fiorino', 'Freemont', 'Grande Punto', 'Panda', 'Punto', 'Qubo', 'Talento', 'Tipo'],
  Ford: ['B-MAX', 'C-MAX', 'EcoSport', 'Edge', 'Explorer', 'Fiesta', 'Focus', 'Galaxy', 'Grand C-MAX', 'Ka', 'Ka+', 'Kuga', 'Mondeo', 'Mustang', 'Mustang Mach-E', 'Puma', 'Ranger', 'S-MAX', 'Tourneo Connect', 'Tourneo Courier', 'Tourneo Custom', 'Transit', 'Transit Connect', 'Transit Custom'],
  Honda: ['Civic', 'CR-V', 'e', 'HR-V', 'Jazz', 'ZR-V'],
  Hyundai: ['Bayon', 'i10', 'i20', 'i30', 'i40', 'Inster', 'Ioniq', 'Ioniq 5', 'Ioniq 6', 'ix20', 'ix35', 'Kona', 'Santa Fe', 'Tucson'],
  Jaguar: ['E-Pace', 'F-Pace', 'F-Type', 'I-Pace', 'XE', 'XF', 'XJ'],
  Jeep: ['Avenger', 'Cherokee', 'Compass', 'Grand Cherokee', 'Renegade', 'Wrangler'],
  Kia: ['Carens', 'Ceed', 'Ceed Tourer', 'EV3', 'EV6', 'EV9', 'Niro', 'Picanto', 'ProCeed', 'Rio', 'Sorento', 'Soul', 'Sportage', 'Stinger', 'Stonic', 'XCeed'],
  'Land Rover': ['Defender', 'Discovery', 'Discovery Sport', 'Freelander', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  Lexus: ['CT', 'ES', 'IS', 'LBX', 'NX', 'RX', 'UX'],
  Mazda: ['CX-3', 'CX-30', 'CX-5', 'CX-60', 'Mazda2', 'Mazda3', 'Mazda6', 'MX-30', 'MX-5'],
  'Mercedes-Benz': ['AMG GT', 'Citan', 'Clase A', 'Clase B', 'Clase C', 'Clase CLA', 'Clase CLS', 'Clase E', 'Clase G', 'Clase GLA', 'Clase GLB', 'Clase GLC', 'Clase GLE', 'Clase GLS', 'Clase S', 'Clase SL', 'Clase SLK', 'Clase V', 'EQA', 'EQB', 'EQC', 'EQE', 'EQS', 'Sprinter', 'Vito'],
  MG: ['3', '4', 'Cyberster', 'EHS', 'HS', 'Marvel R', 'MG5', 'ZS'],
  Mini: ['Cabrio', 'Clubman', 'Countryman', 'Coupé', 'Mini', 'Mini 3 Puertas', 'Mini 5 Puertas', 'Paceman', 'Roadster'],
  Mitsubishi: ['ASX', 'Colt', 'Eclipse Cross', 'L200', 'Outlander', 'Space Star'],
  Nissan: ['Ariya', 'Juke', 'Leaf', 'Micra', 'Navara', 'Note', 'NV200', 'NV300', 'Pathfinder', 'Pulsar', 'Qashqai', 'Townstar', 'X-Trail'],
  Opel: ['Adam', 'Astra', 'Combo', 'Corsa', 'Crossland', 'Crossland X', 'Frontera', 'Grandland', 'Grandland X', 'Insignia', 'Karl', 'Meriva', 'Mokka', 'Mokka X', 'Movano', 'Vivaro', 'Zafira', 'Zafira Life', 'Zafira Tourer'],
  Peugeot: ['1007', '107', '108', '2008', '206', '207', '208', '3008', '301', '307', '308', '308 SW', '4007', '407', '408', '5008', '508', '508 SW', 'Bipper', 'Boxer', 'Expert', 'Partner', 'Rifter', 'Traveller'],
  Porsche: ['911', 'Boxster', 'Cayenne', 'Cayman', 'Macan', 'Panamera', 'Taycan'],
  Renault: ['Arkana', 'Austral', 'Captur', 'Clio', 'Espace', 'Grand Scénic', 'Kadjar', 'Kangoo', 'Koleos', 'Laguna', 'Master', 'Mégane', 'Rafale', 'Scénic', 'Symbioz', 'Talisman', 'Trafic', 'Twingo', 'Zoe'],
  SEAT: ['Alhambra', 'Altea', 'Altea XL', 'Arona', 'Ateca', 'Exeo', 'Ibiza', 'Leon', 'Leon Sportstourer', 'Mii', 'Tarraco', 'Toledo'],
  Skoda: ['Elroq', 'Enyaq', 'Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Octavia Combi', 'Rapid', 'Scala', 'Superb', 'Yeti'],
  Smart: ['#1', '#3', 'ForFour', 'ForTwo'],
  Subaru: ['Crosstrek', 'Forester', 'Impreza', 'Outback', 'XV'],
  Suzuki: ['Across', 'Baleno', 'Ignis', 'Jimny', 'S-Cross', 'Swace', 'Swift', 'Vitara'],
  Tesla: ['Model 3', 'Model S', 'Model X', 'Model Y'],
  Toyota: ['Auris', 'Auris Touring Sports', 'Avensis', 'Aygo', 'Aygo X', 'bZ4X', 'C-HR', 'Camry', 'Corolla', 'Corolla Cross', 'Corolla Touring Sports', 'GT86', 'Hilux', 'Land Cruiser', 'Prius', 'Prius+', 'Proace', 'Proace City', 'RAV4', 'Supra', 'Verso', 'Yaris', 'Yaris Cross'],
  Volkswagen: ['Amarok', 'Arteon', 'Beetle', 'Caddy', 'California', 'Caravelle', 'Crafter', 'Golf', 'Golf Plus', 'Golf Sportsvan', 'Golf Variant', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID. Buzz', 'Jetta', 'Multivan', 'Passat', 'Passat Variant', 'Polo', 'Scirocco', 'Sharan', 'T-Cross', 'T-Roc', 'Taigo', 'Tiguan', 'Tiguan Allspace', 'Touareg', 'Touran', 'Transporter', 'Up!'],
  Volvo: ['C30', 'C40', 'EX30', 'EX40', 'S40', 'S60', 'S90', 'V40', 'V40 Cross Country', 'V60', 'V90', 'XC40', 'XC60', 'XC90'],
};

const plano = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** La marca tal y como se escribe aquí («mercedes» → «Mercedes-Benz», «CITROEN» → «Citroën»), o null. */
export function marcaConocida(marca) {
  const p = plano(marca);
  if (!p) return null;
  if (p === 'vw') return 'Volkswagen';
  if (p === 'mercedes') return 'Mercedes-Benz';
  return Object.keys(MODELOS).find((m) => plano(m) === p) || null;
}

/** Modelos de una marca (vacío si no la conocemos). */
export const modelosDe = (marca) => MODELOS[marcaConocida(marca)] || [];

/**
 * Separa «serie 1 118d sport» en modelo y versión con la lista de la marca (el modelo más largo que encaja al principio).
 * Si no encaja ninguno, la primera palabra es el modelo.
 */
export function separarModelo(marca, texto) {
  const palabras = String(texto || '').trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return { modelo: null, version: null };
  const lista = [...modelosDe(marca)].sort((a, b) => b.length - a.length);
  for (const m of lista) {
    const n = m.split(/\s+/).length;
    if (plano(palabras.slice(0, n).join(' ')) === plano(m)) return { modelo: m, version: palabras.slice(n).join(' ') || null };
  }
  return { modelo: palabras[0].charAt(0).toUpperCase() + palabras[0].slice(1), version: palabras.slice(1).join(' ') || null };
}
