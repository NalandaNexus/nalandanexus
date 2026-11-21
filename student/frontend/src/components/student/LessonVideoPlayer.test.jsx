import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import LessonVideoPlayer from './LessonVideoPlayer';

const ID = 'dQw4w9WgXcQ';
const video = (over = {}) => ({ provider: 'youtube', videoId: ID, title: 'Welcome to Nalanda', description: '', playbackMode: 'embed', embeddable: true, ...over });

afterEach(cleanup);

describe('LessonVideoPlayer', () => {
  it('shows the real thumbnail and a play button, and loads no player yet', () => {
    render(<LessonVideoPlayer video={video()} lessonTitle="Lesson 1" />);
    const img = screen.getByTestId('lesson-video-player').querySelector('img');
    expect(img.getAttribute('src')).toBe(`https://img.youtube.com/vi/${ID}/maxresdefault.jpg`);
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(screen.getByRole('button', { name: 'Play video: Welcome to Nalanda' })).toBeInTheDocument();
    expect(screen.getByText('Welcome to Nalanda')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('plays inside the page in a privacy-enhanced, sandboxed, fullscreen-capable embed', () => {
    render(<LessonVideoPlayer video={video()} />);
    fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
    const frame = document.querySelector('iframe');
    expect(frame).not.toBeNull();
    const src = new URL(frame.getAttribute('src'));
    expect(src.origin).toBe('https://www.youtube-nocookie.com');
    expect(src.pathname).toBe(`/embed/${ID}`);
    expect(src.searchParams.get('autoplay')).toBe('1');
    expect(frame.hasAttribute('allowfullscreen')).toBe(true);
    expect(frame.getAttribute('sandbox')).toMatch(/allow-scripts/);
    expect(frame.getAttribute('title')).toBe('Welcome to Nalanda');
  });

  it('falls back to hqdefault when the HD thumbnail is missing', () => {
    render(<LessonVideoPlayer video={video()} />);
    const player = screen.getByTestId('lesson-video-player');
    const maxres = player.querySelector('img');
    Object.defineProperty(maxres, 'naturalWidth', { value: 120 });
    fireEvent.load(maxres);
    expect(player.querySelector('img').getAttribute('src')).toBe(`https://img.youtube.com/vi/${ID}/hqdefault.jpg`);
  });

  it('when embedding is disabled, explains it and offers YouTube instead of a blank player', () => {
    render(<LessonVideoPlayer video={video({ embeddable: false })} />);
    expect(screen.queryByRole('button', { name: /Play video/ })).toBeNull();
    expect(screen.getByText(/can’t be played here - its owner has turned off playback on other websites, or made it private/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Watch on YouTube/ });
    expect(link).toHaveAttribute('href', `https://www.youtube.com/watch?v=${ID}`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('honours an "open on YouTube" playback mode', () => {
    render(<LessonVideoPlayer video={video({ playbackMode: 'external' })} />);
    expect(screen.queryByRole('button', { name: /Play video/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Watch on YouTube/ })).toBeInTheDocument();
    expect(screen.queryByText(/does not allow/)).toBeNull();
  });

  it('always offers Open on YouTube beneath the player', () => {
    render(<LessonVideoPlayer video={video()} />);
    expect(screen.getByRole('link', { name: /Open on YouTube/ })).toHaveAttribute('href', `https://www.youtube.com/watch?v=${ID}`);
  });

  it('renders nothing for a missing or tampered video id - never an arbitrary iframe', () => {
    const { container, rerender } = render(<LessonVideoPlayer video={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LessonVideoPlayer video={video({ videoId: '"><script>x' })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<LessonVideoPlayer video={video({ videoId: ID, embedUrl: 'https://evil.example/frame' })} />);
    fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
    expect(document.querySelector('iframe').getAttribute('src')).not.toMatch(/evil/);
  });

  it('escapes titles rather than rendering them as markup', () => {
    render(<LessonVideoPlayer video={video({ title: '<img src=x onerror=alert(1)>' })} />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(screen.getByTestId('lesson-video-player').querySelectorAll('img')).toHaveLength(1);
  });

  describe('failures while playing', () => {
    const post = (frame, data, { origin = 'https://www.youtube-nocookie.com', source = frame.contentWindow } = {}) =>
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin, source }));
      });

    it('asks the player for its events, addressed only to YouTube', () => {
      render(<LessonVideoPlayer video={video()} />);
      fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
      const frame = document.querySelector('iframe');
      expect(new URL(frame.src).searchParams.get('enablejsapi')).toBe('1');
      expect(new URL(frame.src).searchParams.get('origin')).toBe(window.location.origin);
      const spy = vi.spyOn(frame.contentWindow, 'postMessage');
      fireEvent.load(frame);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('"listening"'), 'https://www.youtube-nocookie.com');
    });

    it('replaces the frame with the YouTube fallback when embedding turns out to be disabled', () => {
      render(<LessonVideoPlayer video={video()} />);
      fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
      const frame = document.querySelector('iframe');
      post(frame, { event: 'onError', info: 150 });
      expect(document.querySelector('iframe')).toBeNull();
      expect(screen.getByRole('alert')).toHaveTextContent(/can’t be played here - its owner has turned off playback on other websites, or made it private/);
      expect(screen.getByRole('link', { name: /Watch on YouTube/ })).toHaveAttribute('href', `https://www.youtube.com/watch?v=${ID}`);
    });

    it('says a removed or private video is no longer available, without a dead link', () => {
      render(<LessonVideoPlayer video={video()} />);
      fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
      post(document.querySelector('iframe'), { event: 'onError', info: 100 });
      expect(screen.getByRole('alert')).toHaveTextContent(/no longer available/);
      expect(screen.queryByRole('link', { name: /Watch on YouTube/ })).toBeNull();
    });

    it('ignores messages from any other origin or window', () => {
      render(<LessonVideoPlayer video={video()} />);
      fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
      const frame = document.querySelector('iframe');
      post(frame, { event: 'onError', info: 150 }, { origin: 'https://evil.example' });
      post(frame, { event: 'onError', info: 150 }, { source: window });
      post(frame, '<img src=x onerror=alert(1)>');
      expect(document.querySelector('iframe')).not.toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});

describe('LessonVideoPlayer - uploaded files', () => {
  const upload = (over = {}) => ({
    provider: 'upload',
    title: 'Module 1 lecture',
    description: '',
    duration: 754,
    mimeType: 'video/mp4',
    streamUrl: 'https://r2.test/v.mp4?X-Amz-Signature=a',
    ...over,
  });

  it('streams from the signed URL with native controls, a loading indicator and a speed control', () => {
    render(<LessonVideoPlayer video={upload()} />);
    const el = document.querySelector('video');
    expect(el.getAttribute('src')).toBe('https://r2.test/v.mp4?X-Amz-Signature=a');
    expect(el.hasAttribute('controls')).toBe(true);
    expect(el.getAttribute('preload')).toBe('metadata');
    expect(el.hasAttribute('playsinline')).toBe(true);
    expect(el.getAttribute('controlslist')).toBe('nodownload');
    expect(screen.getByTestId('video-buffering')).toBeInTheDocument();
    fireEvent.loadedMetadata(el);
    expect(screen.queryByTestId('video-buffering')).toBeNull();
    fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '1.5' } });
    expect(el.playbackRate).toBe(1.5);
    expect(screen.getByText(/13 min/)).toBeInTheDocument();
  });

  it('on a playback error asks once for a fresh URL, then explains and offers to try again', () => {
    const onExpired = vi.fn();
    render(<LessonVideoPlayer video={upload()} onExpired={onExpired} />);
    const el = document.querySelector('video');
    fireEvent.error(el);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
    // The same URL failing again is not an expiry: say so.
    Object.defineProperty(el, 'error', { value: { code: 4 }, configurable: true });
    fireEvent.error(el);
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot be played in this browser/);
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onExpired).toHaveBeenCalledTimes(2);
  });

  it('says the video is unavailable rather than showing a dead player when no URL could be signed', () => {
    render(<LessonVideoPlayer video={upload({ streamUrl: null })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/temporarily unavailable/);
    expect(document.querySelector('video')).toBeNull();
  });
});

describe('LessonVideoPlayer - Google Drive', () => {
  const DRIVE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
  const drive = (over = {}) => ({ provider: 'google_drive', externalVideoId: DRIVE, title: 'Week 3', description: '', availability: 'available', ...over });

  it('loads Drive only when Play is pressed, in a frame built from the file id', () => {
    render(<LessonVideoPlayer video={drive({ embedUrl: 'https://evil.example/frame' })} />);
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play video: Week 3' }));
    const frame = document.querySelector('iframe');
    expect(frame.getAttribute('src')).toBe(`https://drive.google.com/file/d/${DRIVE}/preview`);
    expect(frame.hasAttribute('allowfullscreen')).toBe(true);
    expect(screen.getByRole('link', { name: /Open in Google Drive/ }).getAttribute('href')).toBe(`https://drive.google.com/file/d/${DRIVE}/view`);
    expect(screen.getByText(/Not loading\? You may need to sign in to Google/)).toBeInTheDocument();
  });

  it('explains a file that is not shared publicly before the student presses Play', () => {
    render(<LessonVideoPlayer video={drive({ availability: 'restricted' })} />);
    expect(screen.getByTestId('drive-access-notice')).toHaveTextContent(/shared privately on Google Drive/);
  });

  it('renders nothing for a tampered file id', () => {
    const { container } = render(<LessonVideoPlayer video={drive({ externalVideoId: '"><script>' })} />);
    expect(container.innerHTML).toBe('');
  });
});
