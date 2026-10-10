/** Reads text aloud with the browser's own voice. `speech` is a BCP 47 code such as "en-US" or "sk-SK". */
export function speak(text: string, speech: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speech;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
