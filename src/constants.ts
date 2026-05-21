import { Category } from './types';

export const DEFAULT_CATEGORIES = [
  // --- TULUD (INCOME) ---
  { name: 'Investeerimistulu', type: 'income', isStarred: false },
  { name: 'Dividenditulu', type: 'income', isStarred: false, parent: 'Investeerimistulu' },
  { name: 'Intressitulu', type: 'income', isStarred: false, parent: 'Investeerimistulu' },

  { name: 'Ühekordsed sissetulekud', type: 'income', isStarred: false },
  { name: 'Kasutatud asjade müük', type: 'income', isStarred: false, parent: 'Ühekordsed sissetulekud' },
  { name: 'Maksed eraisikutelt', type: 'income', isStarred: false, parent: 'Ühekordsed sissetulekud' },
  { name: 'Maksutagastused', type: 'income', isStarred: false, parent: 'Ühekordsed sissetulekud' },

  { name: 'Toetused', type: 'income', isStarred: false },
  { name: 'Peretoetus', type: 'income', isStarred: false, parent: 'Toetused' },
  { name: 'Puudetoetus', type: 'income', isStarred: false, parent: 'Toetused' },
  { name: 'Töötutoetus', type: 'income', isStarred: false, parent: 'Toetused' },

  { name: 'Palk', type: 'income', isStarred: false },

  // --- KULUD (EXPENSES) ---
  { name: 'Transport', type: 'expense', isStarred: false },
  { name: 'Kütus', type: 'expense', isStarred: false, parent: 'Transport' },
  { name: 'Parkimine', type: 'expense', isStarred: false, parent: 'Transport' },
  { name: 'Takso', type: 'expense', isStarred: false, parent: 'Transport' },
  { name: 'Ühistransport', type: 'expense', isStarred: false, parent: 'Transport' },
  { name: 'Auto hooldus ja remont', type: 'expense', isStarred: false, parent: 'Transport' },

  { name: 'Toit', type: 'expense', isStarred: false },
  { name: 'Toidupood', type: 'expense', isStarred: false, parent: 'Toit' },
  { name: 'Väljas söömine', type: 'expense', isStarred: false, parent: 'Toit' },

  { name: 'Meelelahutus', type: 'expense', isStarred: false },
  { name: 'Alkohol', type: 'expense', isStarred: false, parent: 'Meelelahutus' },
  { name: 'Teater, muusika, kino', type: 'expense', isStarred: false, parent: 'Meelelahutus' },
  { name: 'Vaba aeg', type: 'expense', isStarred: false, parent: 'Meelelahutus' },

  { name: 'Hobid', type: 'expense', isStarred: false },
  { name: 'Astronoomia', type: 'expense', isStarred: false, parent: 'Hobid' },
  { name: 'Raimla', type: 'expense', isStarred: false, parent: 'Hobid' },
  { name: 'Käsitöö', type: 'expense', isStarred: false, parent: 'Hobid' },
  { name: 'Kaitseliit', type: 'expense', isStarred: false, parent: 'Hobid' },
  { name: 'Tantsimine', type: 'expense', isStarred: false, parent: 'Hobid' },
  { name: 'Koolitused', type: 'expense', isStarred: false, parent: 'Hobid' },

  { name: 'Kommunaalid', type: 'expense', isStarred: false },
  { name: 'Elekter', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'Gaas', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'II korrus', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'Prügi', type: 'expense', isStarred: false, parent: 'Kommunaalid' },
  { name: 'Vesi', type: 'expense', isStarred: false, parent: 'Kommunaalid' },

  { name: 'Tervis', type: 'expense', isStarred: false },
  { name: 'Apteek', type: 'expense', isStarred: false, parent: 'Tervis' },
  { name: 'Elu- ja tervisekindlustus', type: 'expense', isStarred: false, parent: 'Tervis' },
  { name: 'Arsti visiiditasu', type: 'expense', isStarred: false, parent: 'Tervis' },

  { name: 'Investeeringud', type: 'expense', isStarred: false },
  { name: 'Aktsiad, fondid, võlakirjad', type: 'expense', isStarred: false, parent: 'Investeeringud' },
  { name: 'III sammas', type: 'expense', isStarred: false, parent: 'Investeeringud' },
  { name: 'Hoiused', type: 'expense', isStarred: false, parent: 'Investeeringud' },

  { name: 'Lapsed', type: 'expense', isStarred: false },
  { name: 'Laste rõivad ja jalatsid', type: 'expense', isStarred: false, parent: 'Lapsed' },
  { name: 'Lastehoid', type: 'expense', isStarred: false, parent: 'Lapsed' },
  { name: 'Mänguasjad', type: 'expense', isStarred: false, parent: 'Lapsed' },

  { name: 'Finantsteenused', type: 'expense', isStarred: false },
  { name: 'Internet, telefon, TV', type: 'expense', isStarred: false },
  { name: 'Kodulaen', type: 'expense', isStarred: false },
  { name: 'Reisimine', type: 'expense', isStarred: false },
  { name: 'Riided ja jalanõud', type: 'expense', isStarred: false },
  { name: 'Sularaha väljavõtt', type: 'expense', isStarred: false },
  { name: 'Postikulud', type: 'expense', isStarred: false },
  { name: 'Kodu- ja aiakaubad', type: 'expense', isStarred: false },

  // --- MUU (OTHER) ---
  { name: 'Kategoriseerimata', type: 'both', isStarred: false },
  { name: 'Kanded oma kontode vahel', type: 'both', isStarred: true },
  { name: 'Kingitused', type: 'both', isStarred: false },
  { name: 'Lähetus', type: 'both', isStarred: false }
];
