import React, { useEffect, useState } from 'react';
import { Play, ExternalLink, HardDrive, Film, Loader2, AlertTriangle } from 'lucide-react';
import YouTubeThumbnail from './YouTubeThumbnail';
import { isValidYoutubeVideoId, youtubeEmbedUrl, youtubeWatchUrl } from '../../utils/youtube';
import { isValidGoogleDriveFileId, googleDriveEmbedUrl, googleDriveViewUrl } from '../../utils/googleDrive';

/**
 * A preview of any module video, exactly as students will get it, for editors.
 *
 * Nothing third-party loads until "Preview" is pressed. Frame sources are
 * rebuilt here from validated ids (YouTube's 11-character id, a Drive file id)
 * - never taken from data - so whatever a record holds, the only things this
 * can frame are youtube-nocookie.com/embed/<id> and drive.google.com/file/d/<id>/preview.
 * An uploaded file plays from the short-lived signed URL the server issued,
 * or, before upload, from the local file itself.
 *
 * Copied byte for byte into the Admin portal (see LessonVideoEditor.jsx).
 */
export default function VideoPreview({ provider, videoId, fileId, resourceKey, streamUrl, localFile, title, onThumbStatus }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [localUrl, setLocalUrl] = useState(null);

  // Any change of source closes a playing preview.
  useEffect(() => {
    setOpen(false);
    setLoaded(false);
    setMediaError(false);
  }, [provider, videoId, fileId, streamUrl, localFile]);

  useEffect(() => {
    if (!localFile || typeof URL?.createObjectURL !== 'function') {
      setLocalUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(localFile);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [localFile]);

  const frame = 'relative aspect-video w-full rounded-xl overflow-hidden bg-[#16233F] shadow-sm';
  const label = title || 'Video preview';

  if (provider === 'youtube' && isValidYoutubeVideoId(videoId)) {
    return (
      <div className="space-y-2">
        <div className={frame} data-testid="video-preview">
          {open ? (
            <iframe
              key={videoId}
              src={youtubeEmbedUrl(videoId, { autoplay: true })}
              title={label}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <>
              <YouTubeThumbnail videoId={videoId} alt={title ? `Thumbnail: ${title}` : 'Video thumbnail'} className="absolute inset-0" onStatus={onThumbStatus} />
              <PlayButton onClick={() => setOpen(true)} label="Preview video" />
            </>
          )}
        </div>
        <PreviewLinks open={open} onToggle={() => setOpen((o) => !o)} href={youtubeWatchUrl(videoId)} hrefLabel="Open on YouTube" />
      </div>
    );
  }

  if (provider === 'google_drive' && isValidGoogleDriveFileId(fileId)) {
    return (
      <div className="space-y-2">
        <div className={frame} data-testid="video-preview">
          {open ? (
            <>
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                  <Loader2 className="w-7 h-7 text-white/60 animate-spin" />
                </div>
              )}
              <iframe
                key={fileId}
                src={googleDriveEmbedUrl(fileId, resourceKey)}
                title={label}
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                <HardDrive className="w-8 h-8" aria-hidden="true" />
                <span className="text-[11px]">Google Drive video</span>
              </div>
              <PlayButton onClick={() => setOpen(true)} label="Preview video" />
            </>
          )}
        </div>
        <PreviewLinks open={open} onToggle={() => setOpen((o) => !o)} href={googleDriveViewUrl(fileId, resourceKey)} hrefLabel="Open in Google Drive" />
      </div>
    );
  }

  const src = localUrl || streamUrl;
  if (provider === 'upload' && src) {
    return (
      <div className={frame} data-testid="video-preview">
        {mediaError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/80 text-xs" role="alert">
            <AlertTriangle className="w-6 h-6 text-[#C99A2E]" aria-hidden="true" />
            {localUrl
              ? 'This browser cannot preview this file. It may still play for students in other browsers; MP4 (H.264) plays everywhere.'
              : 'The preview could not be loaded. Reload the page to get a fresh link.'}
          </div>
        ) : (
          <video
            key={src}
            src={src}
            controls
            preload="metadata"
            playsInline
            controlsList="nodownload"
            className="absolute inset-0 w-full h-full bg-black"
            aria-label={label}
            onError={() => setMediaError(true)}
          />
        )}
      </div>
    );
  }

  return (
    <div className={frame} data-testid="video-preview">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-white/50">
        <Film className="w-8 h-8" aria-hidden="true" />
        <span className="text-[11px]">The preview appears here</span>
      </div>
    </div>
  );
}

function PlayButton({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="absolute inset-0 flex items-center justify-center group focus:outline-none" aria-label={label}>
      <span className="w-14 h-14 rounded-full bg-[#AB5236] group-hover:bg-[#94452C] group-focus-visible:ring-4 group-focus-visible:ring-white/60 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
        <Play className="w-6 h-6 fill-white ml-0.5" />
      </span>
    </button>
  );
}

function PreviewLinks({ open, onToggle, href, hrefLabel }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <button type="button" onClick={onToggle} className="font-semibold text-[#22355E] hover:text-[#AB5236]">
        {open ? 'Close preview' : 'Preview'}
      </button>
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#6E6A64] hover:text-[#AB5236]">
        {hrefLabel} <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
