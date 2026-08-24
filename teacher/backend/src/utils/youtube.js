/**
 * Validates and canonicalizes a YouTube URL (master doc §5: "validate that
 * the provided URL is a valid YouTube URL... store the canonical/validated
 * URL"). Accepts youtube.com/watch, youtu.be, and /live/ URLs; returns the
 * canonical `https://www.youtube.com/watch?v=<id>` form, or null if the
 * input isn't a recognizable YouTube URL.
 */
export function canonicalizeYoutubeUrl(input) {
  if (!input || typeof input !== 'string') return null;
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let videoId = null;

  if (host === 'youtu.be') {
    videoId = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v');
    } else if (url.pathname.startsWith('/live/')) {
      videoId = url.pathname.split('/')[2];
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2];
    }
  }

  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export default { canonicalizeYoutubeUrl };
