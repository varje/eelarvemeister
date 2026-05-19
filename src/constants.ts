import { Category } from './types';

export const DEFAULT_CATEGORIES = [
  // Tulud
  { name: 'Tulud', type: 'income', isStarred: false },
  { name: 'Palk', type: 'income', isStarred: false, parent: 'Tulud' },
  { name: 'Investeeringud (tulud)', type: 'income', isStarred: false, parent: 'Tulud' },
  { name: 'Toetused', type: 'income', isStarred: false, parent: 'Tulud' },
  { name: 'Kasutatud asjade müük', type: 'income', isStarred: false, parent: 'Tulud' },
  
  // Kulud
  { name: 'Toit', type: 'expense', isStarred: false },
  { name: 'Toidupood', type: 'expense', isStarred: false, parent: 'Toit' },
  { name: 'Väljas söömine', type: 'expense', isStarred: false, parent: 'Toit' },
  
  { name: 'Meelelahutus', type: 'expense', isStarred: false },
  { name: 'Teater, muusika, kino', type: 'expense', isStarred: false, parent: 'Meelelahutus' },
  { name: 'Alkohol', type: 'expense', isStarred: false, parent: 'Meelelahutus' },
  { name: 'Reisimine', type: 'expense', isStarred: false, parent: 'Meelelahutus' },
  
  { name: 'Kodukulud', type: 'expense', isStarred: false },
  { name: 'Aia- ja kodukaubad', type: 'expense', isStarred: false, parent: 'Kodukulud' },
  { name: 'Tehnika', type: 'expense', isStarred: false, parent: 'Kodukulud' },
  { name: 'Ehitus', type: 'expense', isStarred: false, parent: 'Kodukulud' },
  
  { name: 'Kommunaalid', type: 'expense', isStarred: false },
  { name: 'Elekter', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'Vesi', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'Gaas', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'Internet, TV, telefon', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'Finantsteenused', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  
  { name: 'Hobid', type: 'expense', isStarred: false },
  
  { name: 'Lapsed', type: 'expense', isStarred: false },
  { name: 'Lapse riided', type: 'expense', isStarred: false, parent: 'Lapsed' },
  { name: 'Mänguasjad', type: 'expense', isStarred: false, parent: 'Lapsed' },
  { name: 'Lastehoid', type: 'expense', isStarred: false, parent: 'Lapsed' },
  
  { name: 'Lemmikloomad', type: 'expense', isStarred: false },
  { name: 'Riided ja jalanõud', type: 'expense', isStarred: false },
  
  { name: 'Investeeringud (kulud)', type: 'expense', isStarred: false },
  { name: 'III pensionisammas', type: 'expense', isStarred: false, parent: 'Investeeringud (kulud)' },
  { name: 'Aktsiad, fondid, võlakirjad', type: 'expense', isStarred: false, parent: 'Investeeringud (kulud)' },
  { name: 'Hoiused', type: 'expense', isStarred: false, parent: 'Investeeringud (kulud)' },
  
  // Tulud ja kulud (tavaliselt eiratavad)
  { name: 'Maksed oma kontode vahel', type: 'both', isStarred: true },
  { name: 'Lähetus', type: 'both', isStarred: false },
  { name: 'Kingitused', type: 'both', isStarred: false },
];
