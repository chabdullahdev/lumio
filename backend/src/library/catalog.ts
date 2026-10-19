/**
 * The public-domain reading list and concept map used by
 * `scripts/ingest-library.ts`.
 *
 * Every book is on Project Gutenberg (US public domain). Concepts are grouped
 * by the six launch categories. A concept names the book(s) it draws on and
 * the keyword rules used to find its best passages; the ingest script links
 * only the top-scoring passages so lesson selection stays fast and relevant.
 */
import type { Keyword } from './passages.ts';

export type CatalogBook = {
  /** Project Gutenberg ebook number. */
  gutenbergId: number;
  title: string;
  authors: string[];
  /** Translator / editor, recorded as the edition. */
  edition: string | null;
  /** Year of the original work or (for ancient works) the English translation. */
  publishedYear: number;
  /** Optional: keep only chapters whose title matches (omnibus books). */
  include?: string;
};

export type CatalogConcept = {
  category: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  relevance: 3 | 4 | 5;
  /** Gutenberg ids of the books to search for this concept. */
  books: number[];
  keywords: Keyword[];
  /** Chapter-title bonus pattern (regex source, case-insensitive). */
  sectionPattern?: string;
};

export const BOOKS: CatalogBook[] = [
  // Politics
  { gutenbergId: 3207, title: 'Leviathan', authors: ['Thomas Hobbes'], edition: null, publishedYear: 1651 },
  { gutenbergId: 1232, title: 'The Prince', authors: ['Niccolò Machiavelli'], edition: 'Translated by W. K. Marriott', publishedYear: 1908 },
  { gutenbergId: 7370, title: 'Second Treatise of Government', authors: ['John Locke'], edition: null, publishedYear: 1689 },
  { gutenbergId: 34901, title: 'On Liberty', authors: ['John Stuart Mill'], edition: null, publishedYear: 1859 },
  { gutenbergId: 1404, title: 'The Federalist Papers', authors: ['Alexander Hamilton', 'James Madison', 'John Jay'], edition: null, publishedYear: 1788 },
  { gutenbergId: 815, title: 'Democracy in America, Volume 1', authors: ['Alexis de Tocqueville'], edition: 'Translated by Henry Reeve', publishedYear: 1835 },
  // Psychology
  { gutenbergId: 57628, title: 'The Principles of Psychology, Volume 1', authors: ['William James'], edition: null, publishedYear: 1890 },
  { gutenbergId: 57634, title: 'The Principles of Psychology, Volume 2', authors: ['William James'], edition: null, publishedYear: 1890 },
  { gutenbergId: 16287, title: "Talks to Teachers on Psychology; and to Students on Some of Life's Ideals", authors: ['William James'], edition: null, publishedYear: 1899 },
  { gutenbergId: 75810, title: 'Introductory Lectures on Psycho-Analysis', authors: ['Sigmund Freud'], edition: 'Translated by Joan Riviere', publishedYear: 1922 },
  { gutenbergId: 66048, title: 'The Interpretation of Dreams', authors: ['Sigmund Freud'], edition: 'Translated by A. A. Brill', publishedYear: 1913 },
  { gutenbergId: 445, title: 'The Crowd: A Study of the Popular Mind', authors: ['Gustave Le Bon'], edition: null, publishedYear: 1896 },
  // Science
  { gutenbergId: 1228, title: 'On the Origin of Species', authors: ['Charles Darwin'], edition: null, publishedYear: 1859 },
  { gutenbergId: 34967, title: 'The Descent of Man, and Selection in Relation to Sex, Volume 1', authors: ['Charles Darwin'], edition: null, publishedYear: 1871 },
  { gutenbergId: 5001, title: 'Relativity: The Special and General Theory', authors: ['Albert Einstein'], edition: 'Translated by Robert W. Lawson', publishedYear: 1920 },
  { gutenbergId: 14474, title: 'The Chemical History of a Candle', authors: ['Michael Faraday'], edition: null, publishedYear: 1861 },
  { gutenbergId: 14725, title: 'Treatise on Light', authors: ['Christiaan Huygens'], edition: 'Translated by Silvanus P. Thompson', publishedYear: 1690 },
  { gutenbergId: 15491, title: 'Micrographia', authors: ['Robert Hooke'], edition: null, publishedYear: 1665 },
  { gutenbergId: 46036, title: 'The Sidereal Messenger of Galileo Galilei', authors: ['Galileo Galilei'], edition: 'Translated by Edward Stafford Carlos', publishedYear: 1880 },
  // History
  { gutenbergId: 2707, title: 'The History of Herodotus, Volume 1', authors: ['Herodotus'], edition: 'Translated by George Rawlinson (ed. Macaulay)', publishedYear: 1890 },
  { gutenbergId: 2131, title: 'An Account of Egypt', authors: ['Herodotus'], edition: 'Translated by G. C. Macaulay', publishedYear: 1890 },
  { gutenbergId: 7142, title: 'The History of the Peloponnesian War', authors: ['Thucydides'], edition: 'Translated by Richard Crawley', publishedYear: 1874 },
  { gutenbergId: 10657, title: '"De Bello Gallico" and Other Commentaries', authors: ['Julius Caesar'], edition: 'Translated by W. A. McDevitte', publishedYear: 1869 },
  { gutenbergId: 731, title: 'History of the Decline and Fall of the Roman Empire, Volume 1', authors: ['Edward Gibbon'], edition: 'Ed. J. B. Bury', publishedYear: 1776 },
  { gutenbergId: 10636, title: 'The Travels of Marco Polo, Volume 1', authors: ['Marco Polo'], edition: 'Translated by Henry Yule', publishedYear: 1871 },
  { gutenbergId: 674, title: 'Plutarch: Lives of the Noble Grecians and Romans (Alexander)', authors: ['Plutarch'], edition: 'Translated by John Dryden, ed. A. H. Clough', publishedYear: 1859, include: '^(alexander|alexander the great)\\b' },
  // Islam
  { gutenbergId: 2800, title: 'The Koran (Al-Qur\'an)', authors: ['J. M. Rodwell (translator)'], edition: 'Translated by J. M. Rodwell', publishedYear: 1861 },
  { gutenbergId: 14064, title: 'Mohammed, the Prophet of Islam', authors: ['Herbert E. E. Hayes'], edition: null, publishedYear: 1905 },
  { gutenbergId: 10163, title: 'Mohammedanism: Lectures on Its Origin, Its Religious and Political Growth, and Its Present State', authors: ['C. Snouck Hurgronje'], edition: null, publishedYear: 1916 },
  { gutenbergId: 66960, title: 'The Preaching of Islam', authors: ['Thomas W. Arnold'], edition: null, publishedYear: 1896 },
  { gutenbergId: 37985, title: 'A Literary History of the Arabs', authors: ['Reynold A. Nicholson'], edition: null, publishedYear: 1907 },
  { gutenbergId: 61593, title: 'Arabic Thought and Its Place in History', authors: ['De Lacy O\'Leary'], edition: null, publishedYear: 1922 },
  { gutenbergId: 58977, title: 'The Confessions of Al Ghazzali', authors: ['Al-Ghazali'], edition: 'Translated by Claud Field', publishedYear: 1909 },
  { gutenbergId: 16831, title: 'The Improvement of Human Reason, Exhibited in the Life of Hai Ebn Yokdhan', authors: ['Ibn Tufayl'], edition: 'Translated by Simon Ockley', publishedYear: 1708 },
  // Geopolitics
  { gutenbergId: 13529, title: 'The Influence of Sea Power Upon History, 1660-1783', authors: ['Alfred Thayer Mahan'], edition: null, publishedYear: 1890 },
  { gutenbergId: 15749, title: 'The Interest of America in Sea Power, Present and Future', authors: ['Alfred Thayer Mahan'], edition: null, publishedYear: 1897 },
  { gutenbergId: 132, title: 'The Art of War', authors: ['Sun Tzu'], edition: 'Translated by Lionel Giles', publishedYear: 1910 },
  { gutenbergId: 1946, title: 'On War', authors: ['Carl von Clausewitz'], edition: 'Translated by J. J. Graham', publishedYear: 1873 },
  { gutenbergId: 15776, title: 'The Economic Consequences of the Peace', authors: ['John Maynard Keynes'], edition: null, publishedYear: 1919 },
  { gutenbergId: 38535, title: 'The Great Illusion', authors: ['Norman Angell'], edition: null, publishedYear: 1910 },
  { gutenbergId: 15293, title: 'Influences of Geographic Environment', authors: ['Ellen Churchill Semple'], edition: null, publishedYear: 1911 },
];

function kw(pattern: string, weight = 1): Keyword {
  return { pattern, weight };
}

export const CONCEPTS: CatalogConcept[] = [
  // ---- Politics ---------------------------------------------------------
  {
    category: 'Politics',
    name: 'The social contract',
    description: 'The idea that government rests on an agreement among people to give up some freedom in return for order and protection.',
    difficulty: 3, relevance: 5, books: [3207, 7370],
    keywords: [kw('covenant', 1.5), kw('social compact|social contract|compact', 2), kw('commonwealth'), kw('sovereign'), kw('consent')],
  },
  {
    category: 'Politics',
    name: 'The state of nature',
    description: 'The thought experiment of life before government, used to ask why we need political authority at all.',
    difficulty: 3, relevance: 5, books: [3207, 7370],
    keywords: [kw('state of nature', 3), kw('war of (every man|all)', 3), kw('solitary, poore?, nasty', 4), kw('natural (condition|liberty)', 1.5), kw('without a common power|common power', 1.5)],
  },
  {
    category: 'Politics',
    name: 'Natural rights and property',
    description: 'Locke’s claim that people hold rights to life, liberty and the fruits of their labour before any government exists.',
    difficulty: 3, relevance: 4, books: [7370],
    keywords: [kw('property', 1), kw('labou?r', 1), kw('life, liberty|liberty and estate', 3), kw('law of nature', 2), kw('natural right', 2), kw('mix(ed)? his labou?r', 4)],
  },
  {
    category: 'Politics',
    name: 'Consent of the governed',
    description: 'Why legitimate political power depends on the agreement of the people it rules, and what happens when that trust is broken.',
    difficulty: 3, relevance: 4, books: [7370],
    keywords: [kw('consent', 2), kw('tacit', 3), kw('trust', 1), kw('dissol', 1.5), kw('majority', 1), kw('legislative', 0.5)],
  },
  {
    category: 'Politics',
    name: 'Power, fear and statecraft',
    description: 'Machiavelli’s hard-headed account of how rulers win and keep power, and why appearances matter more than virtue.',
    difficulty: 3, relevance: 5, books: [1232],
    keywords: [kw('virt[uù]', 2), kw('fortune', 2), kw('feared', 1.5), kw('beloved|loved', 1), kw('cruelt', 2), kw('keep (his )?faith', 3), kw('the end justifies|ends? justif', 3)],
  },
  {
    category: 'Politics',
    name: 'The harm principle',
    description: 'Mill’s rule that society may limit a person’s freedom only to prevent harm to others.',
    difficulty: 3, relevance: 5, books: [34901],
    keywords: [kw('harm to others|prevent harm|to prevent (harm|mischief)', 4), kw('self-protection', 3), kw('sovereign', 2), kw('harm', 1), kw('liberty', 0.5)],
  },
  {
    category: 'Politics',
    name: 'Freedom of thought and speech',
    description: 'Why Mill thought open discussion, even of false or unpopular opinions, is essential to finding the truth.',
    difficulty: 3, relevance: 5, books: [34901],
    keywords: [kw('liberty of (thought|opinion|discussion)', 3), kw('silenc', 1.5), kw('opinion', 0.7), kw('discussion', 1.5), kw('infallib', 3), kw('heretic|persecut', 1.5)],
  },
  {
    category: 'Politics',
    name: 'Tyranny of the majority',
    description: 'The danger that a democratic majority can oppress minorities through law and social pressure.',
    difficulty: 3, relevance: 4, books: [34901, 815],
    keywords: [kw('tyranny of the majority', 5), kw('social tyranny', 4), kw('majority', 1), kw('public opinion', 1), kw('minorit', 1.5)],
  },
  {
    category: 'Politics',
    name: 'Factions and the extended republic',
    description: 'Madison’s argument that a large republic can tame factional conflict better than a small one.',
    difficulty: 4, relevance: 5, books: [1404],
    keywords: [kw('faction', 2), kw('extended republic|extent of territory|large republic|extensive republic', 3), kw('mischiefs? of faction', 5), kw('republic', 0.5), kw('interests', 0.5)],
  },
  {
    category: 'Politics',
    name: 'Equality and democratic society',
    description: 'Tocqueville’s portrait of how equality of conditions shapes American habits, ideas and politics.',
    difficulty: 3, relevance: 4, books: [815],
    keywords: [kw('equality of conditions?', 5), kw('democra', 1), kw('aristocra', 1), kw('equality', 1.5), kw('individualism', 2)],
  },
  // ---- Psychology -------------------------------------------------------
  {
    category: 'Psychology',
    name: 'Habit and the brain',
    description: 'How repeated actions wear grooves in the nervous system, and how to build good habits and break bad ones.',
    difficulty: 2, relevance: 5, books: [57628, 16287],
    keywords: [kw('habit', 1.5), kw('plasticity', 3), kw('automatic', 1), kw('nervous', 0.7), kw('ruts?', 1)], sectionPattern: '^habit',
  },
  {
    category: 'Psychology',
    name: 'Attention',
    description: 'How the mind selects a few things from the flood of experience, and why attention shapes what we learn.',
    difficulty: 2, relevance: 5, books: [57628, 16287],
    keywords: [kw('attention', 1.5), kw('interest', 0.5), kw('selective|select', 1), kw('distract', 1.5), kw('focus', 1)], sectionPattern: 'attention',
  },
  {
    category: 'Psychology',
    name: 'The stream of thought',
    description: 'William James’s idea that consciousness is a continuous flowing stream rather than a chain of separate ideas.',
    difficulty: 3, relevance: 5, books: [57628],
    keywords: [kw('stream of (thought|consciousness)|train of thought', 5), kw('stream', 1), kw('consciousness', 1), kw('transitive', 2), kw('fringe', 2)], sectionPattern: 'stream of thought',
  },
  {
    category: 'Psychology',
    name: 'The self',
    description: 'What we mean by “I” and “me”: the bodily, social and spiritual selves and how self-esteem works.',
    difficulty: 3, relevance: 4, books: [57628],
    keywords: [kw('empirical self|social self|material self|spiritual self', 3), kw('self-esteem', 3), kw('the self\\b', 1.5), kw('\\bego\\b', 1), kw('(the )?me and the i|the me\\b', 2)], sectionPattern: 'consciousness of self',
  },
  {
    category: 'Psychology',
    name: 'How memory works',
    description: 'How we retain, recall and forget, and why associations make some memories easier to find than others.',
    difficulty: 2, relevance: 5, books: [57628],
    keywords: [kw('memory', 1.5), kw('retention', 2), kw('recollection|recall', 1), kw('forget', 1.5), kw('association', 1)], sectionPattern: '^memory',
  },
  {
    category: 'Psychology',
    name: 'Emotion and the body',
    description: 'The James–Lange theory that we feel an emotion because of the bodily changes it triggers.',
    difficulty: 3, relevance: 4, books: [57634],
    keywords: [kw('emotion', 1.5), kw('bodily', 2), kw('sorry because we cry|afraid because|because we', 4), kw('visceral|viscera', 2), kw('(shak|trembl)', 1)], sectionPattern: 'emotions?',
  },
  {
    category: 'Psychology',
    name: 'The will',
    description: 'How a thought turns into action: effort, decision, and the experience of choosing.',
    difficulty: 3, relevance: 4, books: [57634],
    keywords: [kw('\\bwill\\b', 0.5), kw('volition', 2), kw('effort', 1), kw('fiat', 3), kw('ideo-?motor', 3), kw('resolve', 1)], sectionPattern: '^will',
  },
  {
    category: 'Psychology',
    name: 'The unconscious and repression',
    description: 'Freud’s idea that painful wishes are pushed out of awareness yet keep shaping our thoughts and behaviour.',
    difficulty: 4, relevance: 4, books: [75810],
    keywords: [kw('repress', 2), kw('unconscious', 2), kw('resistance', 1), kw('neuro(tic|sis)', 1), kw('parapraxes|slips', 3)],
  },
  {
    category: 'Psychology',
    name: 'Dreams and wish-fulfilment',
    description: 'Freud’s theory that dreams disguise hidden wishes, and how he claimed to interpret them.',
    difficulty: 4, relevance: 4, books: [66048],
    keywords: [kw('wish', 1.5), kw('dream-?work', 3), kw('condensation|displacement', 3), kw('manifest|latent', 3), kw('dream', 0.5)],
  },
  {
    category: 'Psychology',
    name: 'Crowd psychology',
    description: 'How people in a crowd think and act differently from the same people alone.',
    difficulty: 3, relevance: 4, books: [445],
    keywords: [kw('crowd', 1), kw('contagion', 3), kw('suggestion', 2), kw('leaders?', 1), kw('mental unity', 5), kw('prestige', 2)],
  },
  // ---- Science ----------------------------------------------------------
  {
    category: 'Science',
    name: 'Natural selection',
    description: 'Darwin’s mechanism for evolution: individuals better suited to their surroundings leave more offspring.',
    difficulty: 3, relevance: 5, books: [1228],
    keywords: [kw('natural selection', 2), kw('preservation of favou?red|favou?rable (variations|differences)', 3), kw('survival of the fittest', 3), kw('adapt', 1)],
  },
  {
    category: 'Science',
    name: 'The struggle for existence',
    description: 'Why more organisms are born than can survive, and how competition drives change.',
    difficulty: 3, relevance: 5, books: [1228],
    keywords: [kw('struggle for (existence|life)', 3), kw('geometrical (ratio|progression)', 3), kw('checks? to increase|check on', 2), kw('compet', 1.5)],
  },
  {
    category: 'Science',
    name: 'Variation and inheritance',
    description: 'How offspring differ from parents, and what breeders of pigeons and plants revealed about heredity.',
    difficulty: 2, relevance: 4, books: [1228],
    keywords: [kw('variation', 1), kw('inherit', 1), kw('domestic', 1), kw('breeds?\\b', 1), kw('pigeons?', 2), kw('breeder', 1.5)],
  },
  {
    category: 'Science',
    name: 'Sexual selection',
    description: 'How competition for mates produces ornaments, songs and weapons that do not help survival.',
    difficulty: 3, relevance: 4, books: [34967],
    keywords: [kw('sexual selection', 3), kw('courtship', 2), kw('ornament', 1), kw('females?', 0.5), kw('peacock', 2), kw('\\bmales?\\b', 0.5)],
  },
  {
    category: 'Science',
    name: 'Special relativity',
    description: 'Einstein’s account of why the speed of light is constant and how time and space depend on the observer.',
    difficulty: 4, relevance: 5, books: [5001],
    keywords: [kw('special theory', 1), kw('simultaneity|simultaneous', 2), kw('lorentz', 2), kw('velocity of light', 2), kw('relativity of', 1), kw('clocks?', 1)],
  },
  {
    category: 'Science',
    name: 'General relativity and gravity',
    description: 'How gravity can be understood as the curving of space and time.',
    difficulty: 5, relevance: 5, books: [5001],
    keywords: [kw('gravitat', 1), kw('equivalence', 2), kw('general (theory|principle)', 1), kw('curv', 1), kw('riemann|gauss', 2), kw('non-euclidean', 2)],
  },
  {
    category: 'Science',
    name: 'The chemistry of a candle',
    description: 'What a burning candle reveals about combustion, water, air and the chemistry of life.',
    difficulty: 2, relevance: 5, books: [14474],
    keywords: [kw('candle', 1), kw('combustion', 2), kw('flame', 1), kw('hydrogen', 1), kw('oxygen', 1), kw('carbonic acid', 2)],
  },
  {
    category: 'Science',
    name: 'The wave theory of light',
    description: 'Huygens’s picture of light as waves spreading through an invisible medium, explaining reflection and refraction.',
    difficulty: 4, relevance: 4, books: [14725],
    keywords: [kw('waves?', 1), kw('ether|aether', 2), kw('refraction', 2), kw('reflexion|reflection', 1), kw('wave ?front', 3)],
  },
  {
    category: 'Science',
    name: 'Seeing the small: early microscopy',
    description: 'Robert Hooke’s first drawings of cells, fleas and crystals seen through a microscope.',
    difficulty: 2, relevance: 4, books: [15491],
    keywords: [kw('microscope', 2), kw('cells?\\b|pores?', 1), kw('cork', 3), kw('flea|louse|gnat', 2), kw('observ\\.', 1)], sectionPattern: 'observ',
  },
  {
    category: 'Science',
    name: 'Galileo’s telescope',
    description: 'What Galileo saw when he first pointed a telescope at the Moon, Jupiter and the Milky Way.',
    difficulty: 2, relevance: 5, books: [46036],
    keywords: [kw('telescope|spy-?glass|perspicillum', 1.5), kw('moons?\\b', 1), kw('jupiter', 2), kw('medicean', 2), kw('milky way', 2), kw('spots?', 1)],
  },
  // ---- History ----------------------------------------------------------
  {
    category: 'History',
    name: 'Croesus, Cyrus and the rise of Persia',
    description: 'How the Persian king Cyrus overthrew the rich kingdom of Lydia and began an empire.',
    difficulty: 2, relevance: 5, books: [2707],
    keywords: [kw('croesus', 2), kw('cyrus', 2), kw('lydia', 1), kw('medes', 1), kw('solon', 2), kw('sardis', 2)],
  },
  {
    category: 'History',
    name: 'Egypt through Greek eyes',
    description: 'Herodotus’s tour of Egypt: the Nile, the priests, the pyramids and the customs that astonished him.',
    difficulty: 2, relevance: 5, books: [2131],
    keywords: [kw('egypt', 0.5), kw('nile', 1.5), kw('pyramid', 2), kw('priests?', 1), kw('embalm', 2), kw('mummy|mummies', 1)],
  },
  {
    category: 'History',
    name: 'Pericles and Athenian democracy',
    description: 'The Funeral Oration and what Pericles said made Athens worth dying for.',
    difficulty: 3, relevance: 5, books: [7142],
    keywords: [kw('pericles', 2), kw('funeral', 3), kw('democracy', 2), kw('our (city|constitution)', 2)],
  },
  {
    category: 'History',
    name: 'The plague of Athens',
    description: 'Thucydides’ eyewitness account of the epidemic that struck Athens in 430 BC.',
    difficulty: 2, relevance: 5, books: [7142],
    keywords: [kw('plague', 3), kw('pestilence', 3), kw('disease', 1), kw('sickness|sick', 1), kw('infect', 1.5)],
  },
  {
    category: 'History',
    name: 'Causes of the Peloponnesian War',
    description: 'How fear of Athenian power and quarrels over Corcyra and Potidaea pushed Greece into war.',
    difficulty: 3, relevance: 5, books: [7142],
    keywords: [kw('corinth', 1), kw('corcyra', 1.5), kw('lacedaemon|sparta', 1), kw('potidaea', 2), kw('growth of (the )?athenian power|true cause', 5), kw('truce|treaty', 0.5)],
  },
  {
    category: 'History',
    name: 'Caesar’s conquest of Gaul',
    description: 'Julius Caesar’s own account of his campaigns against the Gallic tribes.',
    difficulty: 2, relevance: 5, books: [10657],
    keywords: [kw('gaul', 1), kw('helvetii', 2), kw('belgae|belgic', 1.5), kw('legions?', 1), kw('rhine', 1), kw('britain', 1)],
  },
  {
    category: 'History',
    name: 'The Roman Empire at its height',
    description: 'Gibbon’s picture of the empire under the Antonine emperors, and why he called it the happiest age in history.',
    difficulty: 3, relevance: 5, books: [731],
    keywords: [kw('antonin', 2), kw('trajan', 2), kw('hadrian', 2), kw('provinces', 1), kw('legions', 1), kw('augustus', 1)],
  },
  {
    category: 'History',
    name: 'Crisis and decline of Rome',
    description: 'The third-century turmoil: weak emperors, mutinous guards and barbarian pressure on the frontiers.',
    difficulty: 3, relevance: 4, books: [731],
    keywords: [kw('decline', 1), kw('barbarian', 1), kw('praetorian', 2), kw('goths?', 1), kw('commodus', 2), kw('caracalla|elagabalus|decius|valerian', 2)],
  },
  {
    category: 'History',
    name: 'Marco Polo at the court of Kublai Khan',
    description: 'What a Venetian traveller reported about the Mongol empire, its roads, its paper money and its capital.',
    difficulty: 2, relevance: 5, books: [10636],
    keywords: [kw('kublai|cublay|kaan', 3), kw('cathay', 2), kw('paper money', 3), kw('post-?(stations?|houses?)|posts', 1.5), kw('tartars?', 1), kw('cambaluc', 3)],
  },
  {
    category: 'History',
    name: 'Alexander the Great',
    description: 'Plutarch’s portrait of the Macedonian king who conquered the Persian empire before he was thirty-three.',
    difficulty: 2, relevance: 5, books: [674],
    keywords: [kw('alexander', 1), kw('darius', 2), kw('persia', 1), kw('philip', 1), kw('bucephalus', 3), kw('gordian|gordium', 3)],
  },
  // ---- Islam ------------------------------------------------------------
  {
    category: 'Islam',
    name: 'The message of the Qur’an',
    description: 'The Qur’an’s central themes: the oneness of God, mercy, judgment, and guidance for believers.',
    difficulty: 2, relevance: 5, books: [2800],
    keywords: [kw('compassionate|merciful', 2), kw('resurrection|judg(e)?ment', 1.5), kw('believers?', 1), kw('no god but|unity of god', 4), kw('signs?\\b', 1), kw('mercy', 1)],
  },
  {
    category: 'Islam',
    name: 'The life of the Prophet Muhammad',
    description: 'The Prophet’s birth in Mecca, the first revelations, the migration to Medina and the founding of the community.',
    difficulty: 2, relevance: 5, books: [14064],
    keywords: [kw('mohammed|muhammad', 0.5), kw('mecca', 1), kw('medina', 1), kw('khadij', 2), kw('hegira|hijra|flight', 3), kw('koreish|quraysh', 2)],
  },
  {
    category: 'Islam',
    name: 'Faith and ritual practice',
    description: 'Prayer, fasting, almsgiving and pilgrimage: the practices that shape a Muslim’s year and day.',
    difficulty: 2, relevance: 5, books: [10163],
    keywords: [kw('prayers?', 1), kw('fast(ing)?|ramadan', 1.5), kw('pilgrimage', 1.5), kw('alms|zakat', 2), kw('ritual', 1), kw('mecca', 0.5)],
  },
  {
    category: 'Islam',
    name: 'Islamic law',
    description: 'How scholars built a legal tradition from the Qur’an, the Prophet’s example, consensus and reasoning.',
    difficulty: 3, relevance: 4, books: [10163, 61593, 37985],
    keywords: [kw('\\blaw\\b', 1), kw('shari|shar[iī]\'a', 2), kw('fikh|fiqh', 3), kw('juri(st|sprud)', 2), kw('legal', 1), kw('judges?\\b|kadi|cadi', 1), kw('consensus|idj?ma', 3), kw('analogy|qiy[aā]s', 2), kw('abu hanifa|shafi|malik|hanbal', 3)], sectionPattern: 'law|jurisprud|theolog',
  },
  {
    category: 'Islam',
    name: 'How Islam spread',
    description: 'Why many peoples adopted Islam, and the role of preachers, merchants and rulers in its spread.',
    difficulty: 3, relevance: 4, books: [66960],
    keywords: [kw('conver(sion|ted|t)', 1.5), kw('missionar', 1), kw('preach', 1), kw('toleran', 1.5), kw('merchants?|traders?', 1), kw('spread', 1)],
  },
  {
    category: 'Islam',
    name: 'Pre-Islamic Arabia and its poetry',
    description: 'Tribal life, desert poetry and the oral culture the Qur’an first spoke into.',
    difficulty: 3, relevance: 4, books: [37985],
    keywords: [kw('pagan|heathen|pre-?islamic', 1.5), kw('poet', 1), kw('mu\'?allaq|odes?', 3), kw('tribe', 1), kw('bed(ou|u)in', 1), kw('ignorance|jahil', 3)], sectionPattern: 'heathen|pre-?islamic|poet',
  },
  {
    category: 'Islam',
    name: 'The Umayyad and Abbasid caliphates',
    description: 'The two great dynasties that ruled the Muslim world from Damascus and then Baghdad.',
    difficulty: 3, relevance: 4, books: [37985],
    keywords: [kw('o?mayyad|omayyad|umayyad', 2), kw('abbas', 2), kw('caliph', 1), kw('baghdad', 1), kw('damascus', 1)],
  },
  {
    category: 'Islam',
    name: 'Islamic philosophy and the Greek inheritance',
    description: 'How thinkers like al-Kindi, Avicenna and Averroes absorbed and extended Greek philosophy.',
    difficulty: 4, relevance: 4, books: [61593],
    keywords: [kw('aristotle', 1), kw('avicenna|ibn sina', 2), kw('averro[eë]s|ibn rushd', 2), kw('kindi|farabi|farab', 2), kw('philosoph', 1)],
  },
  {
    category: 'Islam',
    name: 'Al-Ghazali’s search for certainty',
    description: 'How a leading scholar fell into doubt, tested every kind of knowledge and found peace in Sufism.',
    difficulty: 3, relevance: 5, books: [58977],
    keywords: [kw('certain', 1.5), kw('doubt', 1.5), kw('sufi', 2), kw('truth', 0.5), kw('scholastic|theolog', 1)],
  },
  {
    category: 'Islam',
    name: 'Reason and revelation: Hayy ibn Yaqzan',
    description: 'A philosophical tale of a man raised alone on an island who discovers God through reason.',
    difficulty: 3, relevance: 4, books: [16831],
    keywords: [kw('hai\\b|hayy', 1), kw('island', 2), kw('reason', 1), kw('contemplat', 1), kw('absal|asal', 2), kw('salaman', 2)],
  },
  // ---- Geopolitics ------------------------------------------------------
  {
    category: 'Geopolitics',
    name: 'Sea power',
    description: 'Mahan’s argument that control of the sea, trade and a strong navy decide the fate of nations.',
    difficulty: 3, relevance: 5, books: [13529],
    keywords: [kw('sea power', 3), kw('commerce', 1), kw('command of the sea', 3), kw('navy|fleet', 0.5), kw('maritime', 1)],
  },
  {
    category: 'Geopolitics',
    name: 'Naval bases and overseas positions',
    description: 'Why harbours, coaling stations and colonies matter to a nation that wants to project power.',
    difficulty: 3, relevance: 4, books: [13529, 15749],
    keywords: [kw('naval (stations?|bases?)|bases? of', 2), kw('coaling', 3), kw('colon(y|ies)', 1), kw('ports?\\b', 0.5), kw('gibraltar|malta', 2)],
  },
  {
    category: 'Geopolitics',
    name: 'Strategic canals and isthmuses',
    description: 'How Panama, Suez and other narrow passages reshape the strategy of the great powers.',
    difficulty: 3, relevance: 4, books: [15749],
    keywords: [kw('canal', 2), kw('isthmus|isthmian', 3), kw('panama', 3), kw('suez', 3), kw('nicaragua', 2)],
  },
  {
    category: 'Geopolitics',
    name: 'Knowing the enemy: deception in war',
    description: 'Sun Tzu’s rules for winning through intelligence, deception and avoiding unnecessary battle.',
    difficulty: 2, relevance: 5, books: [132],
    keywords: [kw('deception|feign', 2), kw('spies|spy', 2), kw('know (your|the) enemy|knowledge of the enemy', 4), kw('all warfare is based on deception', 5), kw('supreme excellence', 4)],
  },
  {
    category: 'Geopolitics',
    name: 'War as an instrument of policy',
    description: 'Clausewitz’s claim that war is not separate from politics but its continuation by other means.',
    difficulty: 4, relevance: 5, books: [1946],
    keywords: [kw('political (object|intercourse|instrument|aim)|policy', 2), kw('continuation of', 4), kw('absolute war', 2), kw('object of war', 2)],
  },
  {
    category: 'Geopolitics',
    name: 'Friction and the fog of war',
    description: 'Why real war is full of uncertainty, chance and small difficulties that plans never foresee.',
    difficulty: 4, relevance: 4, books: [1946],
    keywords: [kw('friction', 4), kw('uncertain', 2), kw('chance', 1), kw('danger', 0.5), kw('intelligence', 1), kw('fatigue', 1)],
  },
  {
    category: 'Geopolitics',
    name: 'The economic peace of Versailles',
    description: 'Keynes’s warning that harsh reparations would damage Europe’s economy and plant the seeds of future conflict.',
    difficulty: 3, relevance: 5, books: [15776],
    keywords: [kw('reparation', 2), kw('treaty', 1), kw('indemnit', 2), kw('germany', 0.5), kw('clemenceau', 2), kw('economic', 0.5)],
  },
  {
    category: 'Geopolitics',
    name: 'The Great Illusion: war and economic interdependence',
    description: 'Angell’s argument that conquest cannot enrich a nation in a world tied together by credit and trade.',
    difficulty: 3, relevance: 4, books: [38535],
    keywords: [kw('conquest', 1), kw('credit', 1.5), kw('indemnit|tribute', 2), kw('commerc|trade', 1), kw('economic', 1), kw('wealth', 1)],
  },
  {
    category: 'Geopolitics',
    name: 'How geography shapes nations',
    description: 'Semple’s study of how climate, coastlines and terrain steer the history of peoples.',
    difficulty: 3, relevance: 4, books: [15293],
    keywords: [kw('climate', 1), kw('geograph', 1), kw('coasts?|coastline', 1), kw('plains?\\b', 1), kw('location', 1), kw('environment', 1)],
  },
  {
    category: 'Geopolitics',
    name: 'Boundaries and natural frontiers',
    description: 'How mountains, rivers and deserts have made some borders stable and others a source of conflict.',
    difficulty: 3, relevance: 4, books: [15293],
    keywords: [kw('boundar', 2), kw('frontier', 2), kw('mountain', 1), kw('rivers?\\b', 1), kw('border', 1), kw('desert', 1)],
  },
];

export const CATEGORY_NAMES = ['Geopolitics', 'History', 'Islam', 'Politics', 'Psychology', 'Science'] as const;
