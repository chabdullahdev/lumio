/**
 * Sample lesson library (temporary).
 *
 * This is the placeholder content shown by sample mode — the app without a
 * configured Supabase project or before the generation pipeline has produced
 * real lessons. Everything here is clearly labelled "Sample lesson" in the UI.
 *
 * Ground rules for this file (same rules the real pipeline must follow):
 * - Every factual claim traces to a listed source; no fabricated quotes,
 *   page numbers, or citations.
 * - Sources are real, verifiable works (OpenStax CC BY, Wikipedia CC BY-SA,
 *   US government public domain, peer-reviewed papers).
 * - Usage is `paraphrase` or `synthesis` only — no direct quotations, so no
 *   `quote` is ever set here.
 *
 * When the backend generator ships, real lessons replace these for configured
 * accounts; sample mode remains the offline fallback.
 */
import { countWords, estimateMinutes } from '../lib/dates';
import type { LessonBlock, LessonContent, LessonSourceRef, Topic } from './types';

export const SAMPLE_TOPICS: Topic[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    name: 'Science',
    slug: 'science',
    description: 'How the natural world works — from cells to climate.',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    name: 'History',
    slug: 'history',
    description: 'People, ideas and events that shaped the world we live in.',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    name: 'Psychology',
    slug: 'psychology',
    description: 'How the mind learns, remembers, decides and feels.',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    name: 'Islam',
    slug: 'islam',
    description: 'Islamic history, thought, scholarship and civilisation.',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    name: 'Geopolitics',
    slug: 'geopolitics',
    description: 'Geography, resources and power between nations.',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    name: 'Politics',
    slug: 'politics',
    description: 'How societies govern themselves and resolve disagreement.',
  },
];

type SampleLesson = {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  concepts: string[];
  blocks: LessonBlock[];
  takeaways: string[];
  sources: LessonSourceRef[];
};

const RAW_LESSONS: SampleLesson[] = [
  {
    id: 'b1000000-0000-4000-8000-000000000001',
    topicId: SAMPLE_TOPICS[3].id, // Islam
    title: 'The House of Wisdom and the Translation Movement',
    summary:
      'In eighth- and ninth-century Baghdad, a generation of scholars translated Greek, Persian and Indian learning into Arabic — and built on it.',
    concepts: ['The House of Wisdom', 'The Graeco-Arabic translation movement'],
    blocks: [
      {
        type: 'paragraph',
        text: 'When the Abbasid caliph al-Mansur founded Baghdad in 762 CE, he placed it at the meeting point of trade routes between Persia, the Levant and the Indian Ocean. Within a few generations the city had become one of the largest and richest in the world — and one of the most curious. Its court sponsored scholars, physicians and translators in a way that had few precedents.',
      },
      { type: 'heading', text: 'A city that collected knowledge' },
      {
        type: 'paragraph',
        text: 'The institution most associated with this activity is the Bayt al-Hikma, or House of Wisdom. It is often described as a library and centre of translation and study, closely linked with the caliph al-Ma\u2019mun (r. 813\u2013833). Historians debate how formal an academy it really was — some scholars argue the evidence points to a palace library and a network of court patronage rather than a single research institute. What is not in dispute is the scale of the work carried out around it: over roughly two centuries, translators rendered a vast body of Greek, Persian, and Indian texts into Arabic.',
      },
      {
        type: 'paragraph',
        text: 'The translation work was not a hobby of kings. Greek medicine, philosophy, astronomy and mathematics were practically useful: physicians needed Galen and Hippocrates, astronomers needed Ptolemy, architects and officials needed geometry and arithmetic. The most famous translator of the era, Hunayn ibn Ishaq, was a Nestorian Christian physician who led a team that translated and revised major Greek medical works into Arabic with unusual care, comparing manuscripts and checking terminology.',
      },
      { type: 'heading', text: 'More than copying' },
      {
        type: 'paragraph',
        text: 'Arab scholars did not stop at translation. The mathematician al-Khwarizmi, working in Baghdad in the ninth century, wrote a systematic treatment of solving equations that gave algebra its name; the term \u201calgorithm\u201d comes from the Latinised form of his name. Algebra and the decimal place-value system reached Europe largely through Arabic texts, and papermaking — adopted from Chinese technology via Central Asia — made copying books far cheaper than parchment had allowed.',
      },
      {
        type: 'paragraph',
        text: 'The movement mattered in both directions. It preserved and enriched Greek learning at a time when much of it was no longer read in Western Europe, and it added centuries of contributions of its own. When Latin Europe rediscovered Aristotle and Ptolemy in the twelfth century, it often did so through Arabic translations and commentaries — at Toledo and elsewhere, translators worked from Arabic into Latin, sometimes with a Jewish or Muslim scholar reading Arabic aloud and a Christian cleric writing Latin. The result was a shared intellectual inheritance rather than a single civilisation\u2019s work.',
      },
      { type: 'heading', text: 'Why it still matters' },
      {
        type: 'paragraph',
        text: 'The translation movement shows how knowledge grows when cultures stay in contact: an idea written in one language, refined in a second, and carried back to a third. It also shows the limits of the \u201clone genius\u201d story. Baghdad\u2019s achievement was institutional as much as intellectual — patronage, libraries, translators, and paper made it possible for hundreds of people to build on each other\u2019s work.',
      },
    ],
    takeaways: [
      'The House of Wisdom is closely tied to the Abbasid court in Baghdad and especially to caliph al-Ma\u2019mun, though historians debate how formal an institution it was.',
      'Over roughly two centuries, the Graeco-Arabic translation movement rendered major Greek, Persian and Indian works of medicine, philosophy, mathematics and astronomy into Arabic.',
      'Translators such as Hunayn ibn Ishaq did scholarly work of their own — comparing manuscripts and standardising terminology — not mere copying.',
      'Baghdad scholars like al-Khwarizmi extended what they translated; algebra and the decimal system reached Europe substantially through Arabic texts.',
      'The movement preserved and enriched Greek learning that later re-entered Western Europe, often via Arabic translations in the twelfth century.',
    ],
    sources: [
      {
        id: 's-islam-1',
        title: 'House of Wisdom',
        authorLine: 'Wikipedia contributors (CC BY-SA 4.0)',
        usage: 'synthesis',
        quote: null,
        pageLabel: null,
        url: 'https://en.wikipedia.org/wiki/House_of_Wisdom',
        licenseLabel: 'CC BY-SA 4.0',
      },
      {
        id: 's-islam-2',
        title: 'Al-Khwarizmi',
        authorLine: 'Wikipedia contributors (CC BY-SA 4.0)',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://en.wikipedia.org/wiki/Al-Khwarizmi',
        licenseLabel: 'CC BY-SA 4.0',
      },
    ],
  },
  {
    id: 'b1000000-0000-4000-8000-000000000002',
    topicId: SAMPLE_TOPICS[0].id, // Science
    title: 'How Photosynthesis Powers Life on Earth',
    summary:
      'Plants, algae and some bacteria turn sunlight into chemical energy — and almost every food chain on the planet depends on the result.',
    concepts: ['Photosynthesis', 'Primary production'],
    blocks: [
      {
        type: 'paragraph',
        text: 'Almost every animal on Earth, including you, eats food that was originally built by photosynthesis. In that process, plants, algae and certain bacteria capture sunlight and use its energy to assemble sugars from carbon dioxide and water. Oxygen is released as a by-product — which is why the planet\u2019s atmosphere contains the oxygen we breathe at all.',
      },
      { type: 'heading', text: 'Two stages, one recipe' },
      {
        type: 'paragraph',
        text: 'A useful shorthand for the overall reaction is: six molecules of carbon dioxide plus six of water, powered by light, become one molecule of glucose and six molecules of oxygen. The work happens in two connected stages inside the plant cell, in structures called chloroplasts, which contain the green pigment chlorophyll.',
      },
      {
        type: 'paragraph',
        text: 'In the first stage — the light-dependent reactions — chlorophyll and other pigments in the chloroplast\u2019s thylakoid membranes absorb light. That energy is used to split water molecules, releasing oxygen, and to charge two carrier molecules, ATP and NADPH. In the second stage — the Calvin cycle — these carriers power a series of reactions that fix carbon dioxide from the air into small three-carbon molecules, which the plant assembles into sugars. The Calvin cycle does not need light directly; it runs on the energy captured in the first stage.',
      },
      {
        type: 'paragraph',
        text: 'Chlorophyll absorbs blue and red light strongly but green less so, which is why leaves look green to us: the green wavelengths are largely reflected rather than used. Different pigments extend the range of light a plant can capture — part of why autumn leaves change colour, as chlorophyll breaks down and other pigments become visible.',
      },
      { type: 'heading', text: 'The biggest chemical industry on the planet' },
      {
        type: 'paragraph',
        text: 'Photosynthesis is also the origin of the oxygen in the atmosphere. Early cyanobacteria began producing it billions of years ago; over immense stretches of time this transformed Earth\u2019s atmosphere and made complex, oxygen-breathing life possible. Photosynthesis today still fixes an enormous quantity of carbon each year — the basis of what ecologists call primary production.',
      },
      {
        type: 'paragraph',
        text: 'Forests and grasslands are the producers we notice, but they are only part of the picture. Marine phytoplankton — drifting microscopic organisms in the sunlit surface of the oceans — account for roughly half of global photosynthetic activity by common estimates. When scientists talk about the ocean as a carbon sink, phytoplankton are a large part of the reason.',
      },
      {
        type: 'paragraph',
        text: 'Understanding photosynthesis is not just botany. It underpins agriculture: crop yields are, in the end, a measure of how efficiently fields convert sunlight into food. It shapes climate science, because the exchange of carbon dioxide between the atmosphere and the living world runs on it. And it is the answer to a deceptively simple question: where does the matter that makes up a tree — or you — ultimately come from? Mostly, from air and water, rearranged with sunlight.',
      },
    ],
    takeaways: [
      'Photosynthesis converts light energy into chemical energy, producing sugars from carbon dioxide and water and releasing oxygen.',
      'It has two linked stages: light-dependent reactions that split water and charge energy carriers, and the Calvin cycle that fixes carbon dioxide using that energy.',
      'Chlorophyll absorbs blue and red light and reflects green, which is why most leaves look green.',
      'Photosynthesis created the oxygen in Earth\u2019s atmosphere and remains the foundation of almost all food chains.',
      'By common estimates, marine phytoplankton carry out roughly half of the planet\u2019s photosynthetic activity.',
    ],
    sources: [
      {
        id: 's-science-1',
        title: 'Biology 2e, Chapter 8: Photosynthesis',
        authorLine: 'OpenStax (CC BY 4.0)',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://openstax.org/books/biology-2e/pages/8-1-overview-of-photosynthesis',
        licenseLabel: 'CC BY 4.0',
      },
      {
        id: 's-science-2',
        title: 'Photosynthesis',
        authorLine: 'Wikipedia contributors (CC BY-SA 4.0)',
        usage: 'synthesis',
        quote: null,
        pageLabel: null,
        url: 'https://en.wikipedia.org/wiki/Photosynthesis',
        licenseLabel: 'CC BY-SA 4.0',
      },
    ],
  },
  {
    id: 'b1000000-0000-4000-8000-000000000003',
    topicId: SAMPLE_TOPICS[1].id, // History
    title: 'The Rosetta Stone and the Key to Ancient Egypt',
    summary:
      'A broken slab found by accident in 1799 gave scholars the key to a writing system that had been silent for more than a thousand years.',
    concepts: ['The Rosetta Stone', 'Decipherment of hieroglyphs'],
    blocks: [
      {
        type: 'paragraph',
        text: 'In July 1799, French soldiers rebuilding a fort near the Egyptian town of Rashid — Rosetta, to the French — found a fragment of a dark stone covered in three different scripts. It was the summer after Napoleon\u2019s expedition landed in Egypt, and the discovery set off one of the great detective stories of scholarship.',
      },
      { type: 'heading', text: 'One decree, three scripts' },
      {
        type: 'paragraph',
        text: 'The stone is part of a larger slab, a broken stele of granodiorite. Its inscription records a decree issued by a council of priests in 196 BCE, during the reign of Ptolemy V, and it is carved three times: in hieroglyphs at the top, in the cursive Egyptian script known as Demotic in the middle, and in Ancient Greek at the bottom. Greek was still widely readable. That meant the same text could be read in a known language and compared against two unknown ones — the essential handle for breaking a code.',
      },
      {
        type: 'paragraph',
        text: 'The stone was not the only clue, and it was not enough by itself. Scholars in Europe worked from copies: French scholars made prints, and when the British took possession of the stone after the French defeat in Egypt, the stone went to the British Museum in 1802, but the rubbings, casts and copies stayed in circulation. That circulation mattered, because the decipherment was completed in France, years later, by a man who never visited Egypt.',
      },
      { type: 'heading', text: 'Champollion\u2019s breakthrough' },
      {
        type: 'paragraph',
        text: 'The decisive insight came from Jean-Fran\u00e7ois Champollion. Earlier attempts assumed hieroglyphs stood only for ideas. Champollion showed that they also recorded sounds — that the script mixed phonetic signs with signs for whole words and with silent signs that helped readers. He demolished the older assumption step by step, using the names enclosed in oval rings, called cartouches, that spelled out royal names in phonetic signs.',
      },
      {
        type: 'paragraph',
        text: 'Champollion announced his breakthrough in 1822, in a letter to a colleague about the alphabet of phonetic signs. He spent the remaining decade reading Egyptian texts at speed and building a grammar and dictionary; he died in 1832, before Egyptology had fully absorbed what he had given it. Once the script could be read, three thousand years of Egyptian records — administrative documents, literature, religious texts, tomb inscriptions — changed from mute monuments into voices. The Rosetta Stone itself is one small administrative document from that vast archive, but it is the one that opened the door.',
      },
    ],
    takeaways: [
      'The Rosetta Stone was found in 1799 near Rosetta (Rashid) by French soldiers, and has been displayed in the British Museum since 1802.',
      'It carries one decree from 196 BCE in three scripts: hieroglyphs, Demotic and Ancient Greek — the Greek gave scholars a known text to compare against.',
      'Scholars worked from copies and rubbings in circulation across Europe, not only from the stone itself.',
      'Champollion\u2019s key insight was that hieroglyphs recorded sounds as well as ideas; he announced the decipherment in 1822.',
      'Decipherment turned centuries of mute Egyptian inscriptions into readable history.',
    ],
    sources: [
      {
        id: 's-history-1',
        title: 'Rosetta Stone',
        authorLine: 'Wikipedia contributors (CC BY-SA 4.0)',
        usage: 'synthesis',
        quote: null,
        pageLabel: null,
        url: 'https://en.wikipedia.org/wiki/Rosetta_Stone',
        licenseLabel: 'CC BY-SA 4.0',
      },
      {
        id: 's-history-2',
        title: 'Explore the collection: the Rosetta Stone',
        authorLine: 'The British Museum',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://www.britishmuseum.org/collection/object/Y_EA24',
        licenseLabel: 'Reference — British Museum collection page',
      },
    ],
  },
  {
    id: 'b1000000-0000-4000-8000-000000000004',
    topicId: SAMPLE_TOPICS[2].id, // Psychology
    title: 'Why Spacing Beats Cramming',
    summary:
      'Studying the same material across separate sessions builds more durable memory than studying it all at once — one of the most reliable findings in learning research.',
    concepts: ['The spacing effect', 'Retrieval practice'],
    blocks: [
      {
        type: 'paragraph',
        text: 'Most people have done it: reviewed everything the night before, passed the exam, and forgotten almost all of it a week later. Cramming is not a sign of laziness — it is what the mind does when a deadline forces material into short-term memory. The problem is that short-term fluency and long-term learning are not the same thing, and they can even look alike.',
      },
      { type: 'heading', text: 'An old discovery, repeatedly confirmed' },
      {
        type: 'paragraph',
        text: 'The psychologist Hermann Ebbinghaus documented the shape of forgetting in the 1880s using careful experiments on himself, memorising nonsense syllables and tracking how much he retained over time. Retention dropped steeply at first and then levelled off. He also noticed that material reviewed in spaced sessions stuck better than material rehearsed in one long block.',
      },
      {
        type: 'paragraph',
        text: 'More than a century later, that second observation is one of the most robust findings in the psychology of learning. A major review published in 2006 by Nicholas Cepeda and colleagues analysed hundreds of experiments involving more than 14,000 participants and found the benefit of spacing over massed study to be highly consistent. The review also found that the best gap between study sessions depends on how long you want to remember: for long-term retention, spread the sessions further apart.',
      },
      { type: 'heading', text: 'Testing beats re-reading' },
      {
        type: 'paragraph',
        text: 'A closely related finding is the testing effect. In a well-known 2006 experiment by Henry Roediger and Jeffrey Karpicke, students who read a passage and then tried to recall it from memory performed better on a later test than students who simply read the passage again — even though re-reading felt more helpful and often did better on an immediate quiz. The act of retrieving information strengthens memory in a way that passive review does not.',
      },
      { type: 'heading', text: 'Why this happens' },
      {
        type: 'paragraph',
        text: 'One way to think about it is that memories are not recordings but patterns that become easier to reactivate through use. Every successful retrieval strengthens the path back to the information; passive re-reading mostly trains recognition — the feeling that you know something — without training recall. Spacing adds a second ingredient: meeting material after some forgetting forces a genuine retrieval effort, a kind of \u201cdesirable difficulty\u201d that quiet familiarity never requires.',
      },
      { type: 'heading', text: 'Using it' },
      {
        type: 'paragraph',
        text: 'Three simple practices follow from the research. First, split study into shorter sessions on separate days rather than one long block. Second, end a session by closing the material and writing down what you remember — retrieval, not review. Third, revisit topics later; the return trip is where durability comes from. None of this requires special tools, though it is exactly why LUMIO tracks concepts over time instead of just counting lessons: a topic you met last week can come back in a later lesson, turning one explanation into spaced practice. And it is a reason not to feel guilty about reading just one lesson today — in memory terms, the next session matters more than this one being long.',
      },
    ],
    takeaways: [
      'Spacing study across separate sessions produces more durable memory than cramming it into one block — a finding confirmed across hundreds of experiments.',
      'The best gap between sessions depends on how long you need to remember; longer retention calls for wider spacing.',
      'Actively retrieving information (trying to recall it) strengthens memory more than re-reading, even when re-reading feels more effective.',
      'Fluency during passive review is a poor guide to what you will actually remember.',
      'Revisiting topics later is not repetition for its own sake — the return trip is what makes learning durable.',
    ],
    sources: [
      {
        id: 's-psychology-1',
        title:
          'Distributed practice in verbal recall tasks: A review and quantitative synthesis',
        authorLine: 'Cepeda, Pashler, Vul, Wixted & Rohrer (2006), Psychological Bulletin',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://doi.org/10.1037/0033-2909.132.3.354',
        licenseLabel: 'Peer-reviewed journal article',
      },
      {
        id: 's-psychology-2',
        title: 'Test-enhanced learning: Taking memory tests improves long-term retention',
        authorLine: 'Roediger & Karpicke (2006), Psychological Science',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x',
        licenseLabel: 'Peer-reviewed journal article',
      },
      {
        id: 's-psychology-3',
        title: 'Testing effect',
        authorLine: 'Wikipedia contributors (CC BY-SA 4.0)',
        usage: 'synthesis',
        quote: null,
        pageLabel: null,
        url: 'https://en.wikipedia.org/wiki/Testing_effect',
        licenseLabel: 'CC BY-SA 4.0',
      },
    ],
  },
  {
    id: 'b1000000-0000-4000-8000-000000000005',
    topicId: SAMPLE_TOPICS[4].id, // Geopolitics
    title: 'The Strait of Malacca: Why One Channel Matters to the World',
    summary:
      'A narrow sea lane between Malaysia and Sumatra carries a huge share of world trade — and that concentration is a strategic fact of its own.',
    concepts: ['Choke points', 'Maritime trade routes'],
    blocks: [
      {
        type: 'paragraph',
        text: 'Around the world, most goods do not move through the air or across borders by truck. They move by sea. The United Nations Conference on Trade and Development (UNCTAD) estimates that around 80 per cent of world merchandise trade by volume is carried by ships. That is why a few narrow sea passages — called choke points — matter far out of proportion to their size. The Strait of Malacca is the busiest of them.',
      },
      { type: 'heading', text: 'A geography lesson with consequences' },
      {
        type: 'paragraph',
        text: 'The strait runs between the Malay Peninsula and the Indonesian island of Sumatra, connecting the Indian Ocean to the South China Sea and onward to the Pacific. It is about 800 kilometres long and narrows to less than three kilometres at its tightest point, in the channel near Singapore. For ships travelling between the Middle East, India or Europe and East Asia, the alternative routes — through the Sunda or Lombok straits, or further south around Australia — add days of sailing and cost.',
      },
      {
        type: 'paragraph',
        text: 'That geography concentrates traffic. The strait carries a large share of the world\u2019s traded goods — commonly estimated at roughly a quarter by volume — and a comparable share of the seaborne oil shipped from the Persian Gulf to East Asian markets. Ports along its approaches, above all Singapore, became among the busiest in the world largely because of the traffic funnelled past them.',
      },
      { type: 'heading', text: 'Why choke points create leverage' },
      {
        type: 'paragraph',
        text: 'When trade concentrates into one channel, control of or disruption to that channel becomes a source of political power. Analysts speak of the \u201cMalacca dilemma\u201d: China imports much of its oil from the Middle East and routes much of its trade through the strait, so any threat to passage there is a strategic vulnerability. Similar reasoning applies to the Strait of Hormuz at the entrance to the Persian Gulf and the Suez Canal between Europe and Asia.',
      },
      {
        type: 'paragraph',
        text: 'The risks are practical as well as military. Piracy and armed robbery at sea were a serious problem in the strait in the early 2000s; cooperative patrols by the littoral states and improved reporting brought incidents down substantially from their peak, though the area remains watched closely. Accidents, silting, and the sheer density of traffic are ongoing realities that shipowners factor into costs.',
      },
      { type: 'heading', text: 'What it shows' },
      {
        type: 'paragraph',
        text: 'The Strait of Malacca is a reminder that geopolitics is often geography plus economics: power follows routes, and routes are shaped by coastlines. Countries and companies respond to that logic — building pipelines, deepening alternative ports, or diversifying suppliers — precisely because one narrow channel can hold a surprisingly large share of the world\u2019s economy.',
      },
    ],
    takeaways: [
      'Around 80% of world merchandise trade by volume travels by sea, making maritime choke points strategically important.',
      'The Strait of Malacca links the Indian Ocean to the Pacific and narrows to under three kilometres at its tightest point.',
      'It carries roughly a quarter of the world\u2019s traded goods by common estimates — the busiest choke point on earth.',
      'Concentration creates leverage and vulnerability; the \u201cMalacca dilemma\u201d describes China\u2019s dependence on the route.',
      'Practical risks — piracy, accidents, congestion — keep the strait under constant attention despite cooperative patrols.',
    ],
    sources: [
      {
        id: 's-geopolitics-1',
        title: 'Strait of Malacca',
        authorLine: 'Wikipedia contributors (CC BY-SA 4.0)',
        usage: 'synthesis',
        quote: null,
        pageLabel: null,
        url: 'https://en.wikipedia.org/wiki/Strait_of_Malacca',
        licenseLabel: 'CC BY-SA 4.0',
      },
      {
        id: 's-geopolitics-2',
        title: 'Review of Maritime Transport',
        authorLine: 'UNCTAD',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://unctad.org/publication/review-maritime-transport-2023',
        licenseLabel: 'UN publication',
      },
      {
        id: 's-geopolitics-3',
        title: 'World Oil Transit Chokepoints',
        authorLine: 'U.S. Energy Information Administration',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://www.eia.gov/international/analysis/special-topics/World_Oil_Transit_Chokepoints',
        licenseLabel: 'U.S. government — public domain',
      },
    ],
  },
  {
    id: 'b1000000-0000-4000-8000-000000000006',
    topicId: SAMPLE_TOPICS[5].id, // Politics
    title: 'Separation of Powers: Why Democracies Divide Authority',
    summary:
      'The idea that lawmaking, enforcement and judging should sit in different hands is centuries old — and still one of the most contested designs in politics.',
    concepts: ['Separation of powers', 'Checks and balances'],
    blocks: [
      {
        type: 'paragraph',
        text: 'Constitutions rarely put all authority in one place. The most common reason is fear of what happens when they do. The doctrine of the separation of powers holds that the three basic functions of government should rest with distinct institutions: a legislature that makes law, an executive that carries it out, and a judiciary that resolves disputes about it.',
      },
      { type: 'heading', text: 'From Montesquieu to the modern constitution' },
      {
        type: 'paragraph',
        text: 'The classic statement of the idea is in Montesquieu\u2019s The Spirit of the Laws, published in 1748. Writing after studying English government, he argued that liberty is unsafe where the power to make laws, to execute them and to judge are combined in the same person or body. His book was widely read, and its influence is visible in the design of the United States Constitution of 1787: Article I gives legislative power to Congress, Article II executive power to the President, and Article III judicial power to the courts.',
      },
      {
        type: 'paragraph',
        text: 'The American founders went further than a mere division of desks. They built overlaps: the President can veto legislation, but Congress can override a veto and controls budgets and appointments; the Senate confirms or rejects nominees; the courts can declare a law unconstitutional — a power established in practice by the Marbury v. Madison decision of 1803. This network of mutual constraints is what is usually meant by checks and balances.',
      },
      { type: 'heading', text: 'Not every democracy separates the same way' },
      {
        type: 'paragraph',
        text: 'The doctrine is not a universal blueprint. In parliamentary systems, such as the United Kingdom, the government is formed from the legislature and stays in office only while it keeps the legislature\u2019s confidence. The executive and legislative branches are fused at the top rather than separated; protections against abuse work more through elections, an independent judiciary, a civil service, and constitutional conventions. Courts in many countries can strike down legislation; in others they cannot, or only rarely.',
      },
      { type: 'heading', text: 'The argument in practice' },
      {
        type: 'paragraph',
        text: 'Separation of powers is easier to state than to keep. Raised to an absolute, it can produce deadlock — institutions blocking each other while problems go unsolved. Weakened too far, it stops being a safeguard and becomes a formality: a legislature that always defers to the executive, or a judiciary appointed for loyalty, offers little protection. Healthy systems depend as much on norms — officials accepting limits, courts accepted as legitimate — as on written rules.',
      },
      {
        type: 'paragraph',
        text: 'That is the core insight worth keeping: the separation of powers is not mainly a design for efficiency. It is a design for safety, built on the assumption that concentrated power tends to be abused, whoever holds it. Judging how well it works in any country means looking beyond the constitution on paper to how the institutions actually behave.',
      },
    ],
    takeaways: [
      'Separation of powers assigns lawmaking, enforcement and judging to distinct institutions, so no single body holds all authority.',
      'Montesquieu gave the classic statement in The Spirit of the Laws (1748), which influenced the U.S. Constitution\u2019s three articles of government.',
      'Checks and balances add deliberate overlaps — vetoes, confirmations, judicial review — so the branches can restrain one another.',
      'Parliamentary systems fuse the executive and legislature at the top rather than separating them, relying on other safeguards.',
      'The design trades efficiency for safety; how well it works depends on norms and behaviour, not just written rules.',
    ],
    sources: [
      {
        id: 's-politics-1',
        title: 'Separation of powers',
        authorLine: 'Wikipedia contributors (CC BY-SA 4.0)',
        usage: 'synthesis',
        quote: null,
        pageLabel: null,
        url: 'https://en.wikipedia.org/wiki/Separation_of_powers',
        licenseLabel: 'CC BY-SA 4.0',
      },
      {
        id: 's-politics-2',
        title: 'The Constitution of the United States',
        authorLine: 'National Archives (1787)',
        usage: 'paraphrase',
        quote: null,
        pageLabel: null,
        url: 'https://www.archives.gov/founding-docs/constitution',
        licenseLabel: 'U.S. government — public domain',
      },
    ],
  },
];

const TOPIC_BY_ID = new Map(SAMPLE_TOPICS.map(topic => [topic.id, topic]));

function toContent(lesson: SampleLesson): LessonContent {
  return {
    id: lesson.id,
    title: lesson.title,
    summary: lesson.summary,
    categoryName: TOPIC_BY_ID.get(lesson.topicId)?.name ?? null,
    estimatedMinutes: estimateMinutes(countWords(lesson.blocks)),
    isSample: true,
    blocks: lesson.blocks,
    takeaways: lesson.takeaways,
    sources: lesson.sources,
  };
}

export type SampleLessonMeta = { topicId: string; concepts: string[] };

export const SAMPLE_LESSONS: LessonContent[] = RAW_LESSONS.map(toContent);

export const SAMPLE_LESSON_META: Record<string, SampleLessonMeta> = Object.fromEntries(
  RAW_LESSONS.map(lesson => [lesson.id, { topicId: lesson.topicId, concepts: lesson.concepts }]),
);

export const SAMPLE_LESSON_IDS_BY_TOPIC: Record<string, string[]> = SAMPLE_TOPICS.reduce(
  (acc, topic) => {
    acc[topic.id] = RAW_LESSONS.filter(lesson => lesson.topicId === topic.id).map(
      lesson => lesson.id,
    );
    return acc;
  },
  {} as Record<string, string[]>,
);
