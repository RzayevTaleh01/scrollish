declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YOUTUBE_API_URL = "https://www.youtube.com/iframe_api";
/** How long the script tag in <head> gets before a second one is added, in case it was blocked or lost. */
const HEAD_SCRIPT_WAIT_MS = 5000;

let apiPromise: Promise<typeof YT> | null = null;

export function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT);

  apiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as typeof YT);
    };
    const add = () => {
      if (window.YT?.Player) return;
      const script = document.createElement("script");
      script.src = YOUTUBE_API_URL;
      document.head.appendChild(script);
    };
    // The page already asks for the script in <head>, so it is usually here or on its way.
    if (document.querySelector(`script[src="${YOUTUBE_API_URL}"]`)) window.setTimeout(add, HEAD_SCRIPT_WAIT_MS);
    else add();
  });

  return apiPromise;
}
