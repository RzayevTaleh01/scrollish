export const TOPICS = [
  // Channels that teach the language itself. Shown as "Learn English", "Learn Slovak" and so on.
  { id: "language", label: "Learn" },
  { id: "science", label: "Science" },
  { id: "tech", label: "Tech" },
  { id: "food", label: "Food" },
  { id: "travel", label: "Travel" },
  { id: "motivation", label: "Motivation" },
  { id: "humor", label: "Comedy" },
  { id: "animals", label: "Nature" },
  { id: "sports", label: "Sports" },
  { id: "world", label: "News" },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];
