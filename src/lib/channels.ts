import type { LanguageId } from "./languages";
import { TOPICS, type TopicId } from "./topics";

interface Channel {
  id: string;
  name: string;
  lang: LanguageId;
  topics: TopicId[];
}

export const CHANNELS: Channel[] = [
  // English
  { id: "UCHaHD477h-FeBbVh9Sh7syA", name: "BBC Learning English", lang: "en", topics: ["language"] },
  { id: "UCxJGMJbjokfnr2-s4_RXPxQ", name: "Speak English With Vanessa", lang: "en", topics: ["language"] },
  { id: "UCvn_XCl_mgQmt3sD753zdJA", name: "Rachel's English", lang: "en", topics: ["language"] },
  { id: "UCz4tgANd4yy8Oe0iXCdSWfA", name: "English with Lucy", lang: "en", topics: ["language"] },
  { id: "UCBHtnQGUChkwG1eyWL5EA9g", name: "ETJ English", lang: "en", topics: ["language"] },

  { id: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium", lang: "en", topics: ["science"] },
  { id: "UCY1kMZp36IQSyNx_9h4mpCg", name: "Mark Rober", lang: "en", topics: ["science", "tech"] },
  { id: "UCZYTClx2T1of7BRZ86-8fow", name: "SciShow", lang: "en", topics: ["science"] },
  { id: "UCpVm7bg6pXKo1Pr6k5kxG9A", name: "National Geographic", lang: "en", topics: ["science", "travel", "animals"] },

  { id: "UCBJycsmduvYEL83R_U4JriQ", name: "Marques Brownlee", lang: "en", topics: ["tech"] },
  { id: "UCXuqSBlHAE6Xw-yeJA0Tunw", name: "Linus Tech Tips", lang: "en", topics: ["tech"] },
  { id: "UCsBjURrPoezykLs9EqgamOA", name: "Fireship", lang: "en", topics: ["tech"] },

  { id: "UCIEv3lZ_tNXHzL3ox-_uUGQ", name: "Gordon Ramsay", lang: "en", topics: ["food"] },
  { id: "UChBEbMKI1eCcejTtmI32UEw", name: "Joshua Weissman", lang: "en", topics: ["food"] },
  { id: "UCbpMy0Fg74eXXkvxJrtEn3w", name: "Bon Appetit", lang: "en", topics: ["food"] },

  { id: "UC0Ize0RLIbGdH5x4wI45G-A", name: "Drew Binsky", lang: "en", topics: ["travel"] },
  { id: "UCPsil91i8gN0XLIbwl3vqsw", name: "Lonely Planet", lang: "en", topics: ["travel"] },
  { id: "UCwmZiChSryoWQCZMIQezgTg", name: "BBC Earth", lang: "en", topics: ["animals", "science"] },

  { id: "UCoOae5nYA7VqaXzerajD0lg", name: "Ali Abdaal", lang: "en", topics: ["motivation"] },
  { id: "UCctXZhXmG-kf3tlIXgVZUlw", name: "GaryVee", lang: "en", topics: ["motivation"] },
  { id: "UCk2U-Oqn7RXf-ydPqfSxG5g", name: "Mel Robbins", lang: "en", topics: ["motivation"] },
  { id: "UCsT0YIqwnpJCM-mx7-gSA4Q", name: "TEDx Talks", lang: "en", topics: ["motivation"] },
  { id: "UCAuUUnT6oDeKwE6v1NGQxug", name: "TED", lang: "en", topics: ["motivation", "science"] },

  { id: "UCObk_g1hQBy0RKKriVX_zOQ", name: "Netflix Is A Joke", lang: "en", topics: ["humor"] },
  { id: "UCa6vGFO9ty8v5KZJXQxdhaw", name: "Jimmy Kimmel Live", lang: "en", topics: ["humor"] },

  { id: "UCINb0wqPz-A0dV9nARjJlOQ", name: "The Dodo", lang: "en", topics: ["animals"] },

  { id: "UCWJ2lWNubArHWmf3FIHbfcQ", name: "NBA", lang: "en", topics: ["sports"] },
  { id: "UCiWLfSweyRNmLpgEHekhoAg", name: "ESPN", lang: "en", topics: ["sports"] },
  { id: "UCvgfXK4nTYKudb0rFR6noLA", name: "UFC", lang: "en", topics: ["sports"] },

  { id: "UCLXo7UDZvByw2ixzpQCufnA", name: "Vox", lang: "en", topics: ["world"] },
  { id: "UC16niRr50-MSBwiO3YDb3RA", name: "BBC News", lang: "en", topics: ["world"] },
  { id: "UCV3Nm3T-XAgVhKH9jT0ViRg", name: "AJ+", lang: "en", topics: ["world"] },

  // Slovak. Most of these rely on YouTube's automatic Slovak captions.
  { id: "UCpq-FGJCkoKyk0P80tzLDOQ", name: "Joyful Slovak", lang: "sk", topics: ["language"] },
  { id: "UCGMtCzls8WhmFQl16-jmDYg", name: "Linguarte", lang: "sk", topics: ["language"] },

  { id: "UCA0qaLDDrr3m4MUQ0L_cFzg", name: "Zmudri G", lang: "sk", topics: ["science", "world"] },
  { id: "UCtW6UE6h-Na5E5BCLBafbcQ", name: "Dejepis Inak", lang: "sk", topics: ["science"] },

  { id: "UCw3Ma9cU8_8Sh8Zo4MeaQEQ", name: "Michal Plochan", lang: "sk", topics: ["motivation"] },
  { id: "UC0ZqOD6PkKGrPbu_hhK9B5g", name: "Smart-Life Club", lang: "sk", topics: ["motivation"] },
  { id: "UCwvbE6i9n3fMqus4fnG2PcQ", name: "leaderxcastclips", lang: "sk", topics: ["motivation"] },
  { id: "UCtcGvgyF5SSpK5IXLMz79TA", name: "Pozitívna Myseľ", lang: "sk", topics: ["motivation"] },
  { id: "UCm3KWuHbScDjr54EI53AnbQ", name: "Forbes Slovensko", lang: "sk", topics: ["motivation", "world"] },

  { id: "UCoz07xBkEDkIUee_vaKVgLA", name: "Denisa Vyšňovská", lang: "sk", topics: ["food", "humor"] },
  { id: "UC5JSIA4A4-WpeX-Wm-YPbWQ", name: "Babička a Lianka varia", lang: "sk", topics: ["food"] },

  { id: "UC-xuLTQ-_qJ1BVfrHmwcBjA", name: "Adam GAZDA Belica", lang: "sk", topics: ["travel"] },
  { id: "UCYwUx2D9GgP6SD3vxQsacMQ", name: "MediaRZ", lang: "sk", topics: ["travel"] },
  { id: "UCf9VIUQtJqUVnwVFGBrD-Rg", name: "Šťastlivo", lang: "sk", topics: ["travel"] },
  { id: "UChVnZeZ-2mq7wlRYavQQZGA", name: "Okolo sveta", lang: "sk", topics: ["travel"] },
  { id: "UCzSQmM2k33BtBF_NX2fOpaA", name: "Krížom Krážom", lang: "sk", topics: ["travel"] },

  { id: "UCjtoi8EsCjjb5ZJDcK8xvZw", name: "Šport_sk", lang: "sk", topics: ["sports"] },
  { id: "UCnsJwclLQjTmozEi4dN9AWA", name: "Slovenský hokej", lang: "sk", topics: ["sports"] },

  { id: "UCewFV_KI5BSu0f8bKZ4BMfA", name: "GoGoManTV", lang: "sk", topics: ["humor"] },
  { id: "UCf4pkVHnnWTqUbjxZgFzvfw", name: "Duklock", lang: "sk", topics: ["humor"] },
  { id: "UC_CkNfZabWeEDHJe_jbHyhg", name: "Basta Fix", lang: "sk", topics: ["humor"] },

  { id: "UC3xryLcGrQ_sA0o38lpH70Q", name: "Daniel Csúr", lang: "sk", topics: ["world"] },
];

/** Topics that have at least one channel in the given language, in the usual chip order. */
export function topicsForLanguage(lang: LanguageId): TopicId[] {
  const used = new Set(CHANNELS.filter((c) => c.lang === lang).flatMap((c) => c.topics));
  return TOPICS.map((t) => t.id).filter((id) => used.has(id));
}
