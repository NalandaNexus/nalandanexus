import React, { useEffect, useRef, useState } from 'react';
import { Play, ExternalLink, Loader2, ShieldAlert, AlertCircle, HardDrive, RotateCcw, Gauge } from 'lucide-react';
import YouTubeThumbnail from './YouTubeThumbnail';
import {
  isValidYoutubeVideoId,
  youtubeEmbedUrl,
  youtubeWatchUrl,
  describeYoutubePlayerError,
  YOUTUBE_EMBED_ORIGIN,
} from '../../utils/youtube';
import { isValidGoogleDriveFileId, googleDriveEmbedUrl, googleDriveViewUrl } from '../../utils/googleDrive';

/**
 * A module's (or a lesson's) video: a file uploaded to the school's private
 * storage, a Google Drive video, or a YouTube video - each with its own player
 * below. YouTube videos are shown thumbnail first.
 *
 * Nothing from YouTube loads until the student presses Play: the page shows the
 * video's own thumbnail on a dark surface of fixed 16:9 size (so nothing shifts
 * when it arrives), and only then mounts the privacy-enhanced embed. A lesson
 * page with a video therefore costs one image, not a player.
 *
 * The iframe source is never taken from data. It is rebuilt here from the
 * video id, after the id passes the same 11-character check the server
 * applied - so whatever a lesson record holds, the only thing this can frame
 * is youtube-nocookie.com/embed/<id>.
 *
 * Two layers keep a student from facing a dead player. Before playing: a video
 * the server knows cannot be embedded, or one set to open on YouTube, shows
 * "Watch on YouTube" instead of Play. While playing: the embed reports its own
 * errors (the owner disabled embedding after it was saved, it was made private
 * or removed), and the frame is replaced by the same explanation and link.
 * Player messages are accepted only from this frame and only from YouTube's
 * embed origin, and only their numeric error code is read.
 */
export default function LessonVideoPlayer({ video, lessonTitle, showDescription = true, onExpired }) {
  const [playing, setPlaying] = useState(false);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [thumbReady, setThumbReady] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const frameRef = useRef(null);

  // Listen to the embedded player for as long as it is mounted.
  useEffect(() => {
    if (!playing) return undefined;
    const onMessage = (event) => {
      if (event.origin !== YOUTUBE_EMBED_ORIGIN || event.source !== frameRef.current?.contentWindow) return;
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.event === 'onError') {
        const code = Number(data.info);
        if (Number.isFinite(code)) setPlayerError(describeYoutubePlayerError(code));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [playing]);

  if (!video) return null;
  if (video.provider === 'upload') {
    return <UploadedVideoPlayer video={video} title={video.title || lessonTitle || 'Lesson video'} showDescription={showDescription} onExpired={onExpired} />;
  }
  if (video.provider === 'google_drive') {
    return <DriveVideoPlayer video={video} title={video.title || lessonTitle || 'Lesson video'} showDescription={showDescription} />;
  }

  if (!isValidYoutubeVideoId(video.videoId)) return null;

  const { videoId } = video;
  const title = video.title || lessonTitle || 'Lesson video';
  const watchUrl = youtubeWatchUrl(videoId);
  const blocked = video.embeddable === false;
  const external = blocked || video.playbackMode === 'external';
  const showFrame = playing && !external && !playerError;
  const notice = playerError?.message || (blocked ? describeYoutubePlayerError(150).message : null);

  let embedSrc = null;
  if (showFrame) {
    try {
      embedSrc = youtubeEmbedUrl(videoId, { autoplay: true, apiOrigin: window.location.origin });
    } catch {
      // An origin the player API will not accept (e.g. a file:// preview):
      // play without error reporting rather than not at all.
      embedSrc = youtubeEmbedUrl(videoId, { autoplay: true });
    }
  }

  const onFrameLoad = () => {
    setFrameLoaded(true);
    // Asks the player to start sending its events (the documented handshake of
    // YouTube's iframe API), addressed only to YouTube's embed origin.
    try {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: videoId }), YOUTUBE_EMBED_ORIGIN);
    } catch {
      // Without events the player still works; it just cannot report failures.
    }
  };

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0F1A30] shadow-lg border border-[#DFDACB]"
        data-testid="lesson-video-player"
      >
        {showFrame ? (
          <>
            {!frameLoaded && (
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
              </div>
            )}
            <iframe
              ref={frameRef}
              src={embedSrc}
              title={title}
              onLoad={onFrameLoad}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            />
          </>
        ) : (
          <>
            {!thumbReady && <div className="absolute inset-0 bg-[#16233F] animate-pulse" aria-hidden="true" />}
            <YouTubeThumbnail
              videoId={videoId}
              alt=""
              className="absolute inset-0"
              imgClassName={external || playerError ? 'opacity-60' : ''}
              onStatus={() => setThumbReady(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20 pointer-events-none" />

            {external || playerError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center" role={playerError ? 'alert' : undefined}>
                {notice && (
                  <p className="max-w-sm text-xs sm:text-sm text-white/90 flex items-start gap-2 bg-black/40 rounded-xl px-3 py-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-px text-[#C99A2E]" aria-hidden="true" />
                    <span>
                      {notice}
                      {playerError?.reason !== 'unavailable' && ' You can still watch it on YouTube.'}
                    </span>
                  </p>
                )}
                {playerError?.reason !== 'unavailable' && (
                  <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#AB5236] hover:bg-[#92422a] text-white font-heading font-bold text-sm shadow-lg transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
                  >
                    <Play className="w-4 h-4 fill-white" aria-hidden="true" />
                    Watch on YouTube
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute inset-0 flex items-center justify-center group focus:outline-none"
                aria-label={`Play video: ${title}`}
              >
                <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#AB5236]/95 text-white flex items-center justify-center shadow-2xl ring-4 ring-white/15 transition-transform duration-200 group-hover:scale-105 group-hover:bg-[#92422a] group-focus-visible:ring-white/70">
                  <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1" aria-hidden="true" />
                </span>
              </button>
            )}

            <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 pointer-events-none">
              <p className="font-heading font-bold text-sm sm:text-base text-white drop-shadow line-clamp-2">{title}</p>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-[11px] font-data text-[#2B2B28]/55 truncate">{showDescription && video.description ? video.description : 'YouTube'}</span>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors"
        >
          Open on YouTube <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/**
 * An uploaded video, streamed from private storage with HTTP range requests
 * on a short-lived signed URL the course API issued to this enrolled student.
 *
 * The browser's own controls give play/pause, seeking, volume and full
 * screen on desktop and mobile alike; speed is offered separately because not
 * every browser puts it in its controls. While the video buffers a spinner
 * shows. When the signed URL lapses (the student left the tab paused for
 * hours) or a request fails, the player asks the page for a fresh URL once and
 * resumes where it was; only if that fails too does it explain the problem.
 */
function UploadedVideoPlayer({ video, title, showDescription, onExpired }) {
  const ref = useRef(null);
  const [buffering, setBuffering] = useState(true);
  const [failure, setFailure] = useState(null);
  const [speed, setSpeed] = useState(1);
  const resumeAt = useRef(null);
  const refreshedFor = useRef(null);

  // A fresh URL for the same video keeps the position (and playing state).
  useEffect(() => {
    const el = ref.current;
    setFailure(null);
    if (!el || !resumeAt.current) return;
    const { time, playing } = resumeAt.current;
    resumeAt.current = null;
    const restore = () => {
      try {
        el.currentTime = time;
      } catch {
        // Seeking before metadata is a no-op; the student can seek themselves.
      }
      el.playbackRate = speed;
      if (playing) el.play?.()?.catch?.(() => {});
    };
    el.addEventListener('loadedmetadata', restore, { once: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.streamUrl]);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [speed]);

  if (!video.streamUrl) {
    return (
      <PlayerShell>
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center text-sm text-white/90">
          <AlertCircle className="w-6 h-6 text-[#C99A2E]" aria-hidden="true" />
          This video is temporarily unavailable. Please try again in a few minutes.
        </div>
      </PlayerShell>
    );
  }

  const onError = () => {
    const el = ref.current;
    const code = el?.error?.code;
    if (refreshedFor.current !== video.streamUrl && onExpired) {
      // Most often an expired link: get a new one and carry on from here.
      refreshedFor.current = video.streamUrl;
      resumeAt.current = { time: el?.currentTime || 0, playing: el ? !el.paused : false };
      setBuffering(true);
      onExpired();
      return;
    }
    setBuffering(false);
    setFailure(
      code === 4
        ? 'This video cannot be played in this browser. Try Chrome, Edge or Firefox, or another device.'
        : 'The video could not be loaded. Check your connection and try again.'
    );
  };

  return (
    <div className="space-y-2">
      <PlayerShell>
        <video
          ref={ref}
          src={video.streamUrl}
          controls
          preload="metadata"
          playsInline
          controlsList="nodownload"
          className="absolute inset-0 w-full h-full bg-black"
          aria-label={title}
          onLoadStart={() => setBuffering(true)}
          onWaiting={() => setBuffering(true)}
          onLoadedMetadata={() => setBuffering(false)}
          onCanPlay={() => setBuffering(false)}
          onPlaying={() => setBuffering(false)}
          onError={onError}
        >
          Your browser does not support this video.
        </video>
        {buffering && !failure && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" data-testid="video-buffering">
            <Loader2 className="w-9 h-9 text-white/70 animate-spin" aria-label="Loading video" />
          </div>
        )}
        {failure && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-5 text-center text-sm text-white">
            <AlertCircle className="w-6 h-6 text-[#C99A2E]" aria-hidden="true" />
            <span>{failure}</span>
            {onExpired && (
              <button
                type="button"
                onClick={() => {
                  refreshedFor.current = null;
                  setFailure(null);
                  setBuffering(true);
                  onExpired();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#AB5236] hover:bg-[#92422a] text-white text-xs font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Try again
              </button>
            )}
          </div>
        )}
      </PlayerShell>
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-[11px] font-data text-[#2B2B28]/55 truncate">
          {showDescription && video.description ? video.description : title}
          {Number.isFinite(video.duration) ? ` · ${formatMinutes(video.duration)}` : ''}
        </span>
        <label className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#22355E]">
          <Gauge className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Speed</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="bg-transparent border border-[#DFDACB] rounded px-1 py-0.5" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/**
 * A Google Drive video, in Drive's own player. Nothing from Google loads until
 * Play is pressed. The frame source is rebuilt here from the validated file id,
 * never taken from data. Drive decides who may watch: a file that is not shared
 * publicly plays only for students signed in to Google with an account it is
 * shared with, so that case is explained up front, and every Drive video has a
 * way out to Drive itself.
 */
function DriveVideoPlayer({ video, title, showDescription }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileId = video.externalVideoId;
  if (!isValidGoogleDriveFileId(fileId)) return null;
  const key = video.externalResourceKey || null;
  const restricted = video.availability === 'restricted';

  return (
    <div className="space-y-2">
      <PlayerShell>
        {open ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
              </div>
            )}
            <iframe
              src={googleDriveEmbedUrl(fileId, key)}
              title={title}
              onLoad={() => setLoaded(true)}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-[#16233F] to-[#0F1A30]" aria-hidden="true" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#AB5236]/95 text-white flex items-center justify-center shadow-2xl ring-4 ring-white/15 hover:scale-105 hover:bg-[#92422a] transition-transform focus:outline-none focus-visible:ring-white/70"
                aria-label={`Play video: ${title}`}
              >
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white ml-1" aria-hidden="true" />
              </button>
              {restricted && (
                <p className="max-w-sm text-xs text-white/85 flex items-start gap-2 bg-black/40 rounded-xl px-3 py-2" data-testid="drive-access-notice">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-px text-[#C99A2E]" aria-hidden="true" />
                  <span>This video is shared privately on Google Drive. Sign in to Google with the account your teacher shared it with to watch it.</span>
                </p>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 pointer-events-none">
              <p className="font-heading font-bold text-sm sm:text-base text-white drop-shadow line-clamp-2 flex items-center gap-2">
                <HardDrive className="w-4 h-4 shrink-0" aria-hidden="true" /> {title}
              </p>
            </div>
          </>
        )}
      </PlayerShell>
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="text-[11px] font-data text-[#2B2B28]/55 truncate">
          {showDescription && video.description ? video.description : open ? 'Not loading? You may need to sign in to Google, or ask your teacher to share it.' : 'Google Drive'}
        </span>
        <a
          href={googleDriveViewUrl(fileId, key)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#22355E] hover:text-[#AB5236] transition-colors"
        >
          Open in Google Drive <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function PlayerShell({ children }) {
  return (
    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0F1A30] shadow-lg border border-[#DFDACB]" data-testid="lesson-video-player">
      {children}
    </div>
  );
}

function formatMinutes(seconds) {
  const m = Math.round(seconds / 60);
  return m >= 1 ? `${m} min` : `${Math.round(seconds)} s`;
}
