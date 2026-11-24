export type SpeechAccent = "en-US" | "en-GB";

/**
 * Plays pronunciation audio from a dictionary MP3 URL if available,
 * falling back to the browser Web Speech API (`speechSynthesis`).
 */
export async function playWordAudio(
  text: string,
  audioUrl?: string | null,
  accent: SpeechAccent = "en-US"
): Promise<void> {
  const cleanText = text.trim();
  const cleanUrl = audioUrl?.trim();

  if (cleanUrl && typeof Audio !== "undefined") {
    try {
      const audio = new Audio(cleanUrl);
      await audio.play();
      return;
    } catch {
      // Fall back to browser speech synthesis when MP3 playback fails or is blocked.
    }
  }

  if (
    !cleanText ||
    typeof window === "undefined" ||
    typeof window.speechSynthesis === "undefined" ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = accent;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Safe no-op if speech synthesis is unavailable in the host environment.
  }
}
