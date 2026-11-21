import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import LessonVideoEditor from './LessonVideoEditor';

const ID = 'dQw4w9WgXcQ';
const DRIVE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const lesson = { kind: 'module', lessonId: 'mod-1', title: 'Module 1: Awakening', video: null, legacyVideoUrl: '' };

function makeApi(over = {}) {
  return {
    inspect: vi.fn().mockResolvedValue({ provider: 'youtube', videoId: ID, availability: 'available', title: 'Never Gonna Give You Up' }),
    save: vi.fn().mockImplementation(async (p) => ({ video: { provider: p.provider, videoId: ID, ...p, updatedAt: '2026-11-21T00:00:00Z' } })),
    update: vi.fn().mockImplementation(async (p) => ({ video: { provider: 'youtube', videoId: ID, ...p } })),
    remove: vi.fn().mockResolvedValue({ removed: true }),
    startUpload: vi.fn(),
    partUrls: vi.fn(),
    resume: vi.fn(),
    complete: vi.fn(),
    abortUpload: vi.fn().mockResolvedValue({ aborted: true }),
    ...over,
  };
}

function setup({ lessonOverride = {}, api: apiOver = {}, tab = 'YouTube link', uploadsEnabled = true } = {}) {
  const api = makeApi(apiOver);
  const handlers = { onSaved: vi.fn(), onRemoved: vi.fn(), onConflict: vi.fn(), onClose: vi.fn() };
  render(<LessonVideoEditor lesson={{ ...lesson, ...lessonOverride }} api={api} uploadScope="admin:prarambh:m:mod-1" uploadsEnabled={uploadsEnabled} maxUploadBytes={1024 ** 3} {...handlers} />);
  if (tab) fireEvent.click(screen.getByRole('tab', { name: new RegExp(tab) }));
  return { api, ...handlers };
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const status = () => screen.getByTestId('video-status').textContent;
const publishButton = () => screen.getByRole('button', { name: /^Publish$/ });

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('LessonVideoEditor - YouTube', () => {
  it('starts empty with guidance and nothing to publish', () => {
    setup();
    expect(screen.getByText('Module video')).toBeInTheDocument();
    expect(status()).toMatch(/Paste a YouTube link/);
    expect(publishButton()).toBeDisabled();
  });

  it('explains an invalid link immediately and never asks the server about it', async () => {
    const { api } = setup();
    type('YouTube video URL', 'https://vimeo.com/12345');
    expect(status()).toMatch(/Only YouTube links are supported/);
    expect(screen.getByLabelText('YouTube video URL')).toHaveAttribute('aria-invalid', 'true');
    type('YouTube video URL', 'https://www.youtube.com/watch?v=short');
    expect(status()).toMatch(/malformed video id/);
    await new Promise((r) => setTimeout(r, 650));
    expect(api.inspect).not.toHaveBeenCalled();
    expect(publishButton()).toBeDisabled();
  });

  it('shows the thumbnail at once, then checks the link and fills the title, without overwriting a typed one', async () => {
    const { api } = setup();
    type('YouTube video URL', `https://youtu.be/${ID}`);
    expect(screen.getByTestId('video-preview').querySelector('img').getAttribute('src')).toBe(`https://img.youtube.com/vi/${ID}/maxresdefault.jpg`);
    expect(status()).toMatch(/Checking with YouTube/);
    await waitFor(() => expect(status()).toMatch(/Valid YouTube video/));
    expect(api.inspect).toHaveBeenCalledWith(`https://youtu.be/${ID}`, expect.objectContaining({ provider: 'youtube' }));
    expect(screen.getByLabelText('Video title')).toHaveValue('Never Gonna Give You Up');
    cleanup();

    setup();
    type('Video title', 'My own title');
    type('YouTube video URL', `https://youtu.be/${ID}`);
    await waitFor(() => expect(status()).toMatch(/Valid/));
    expect(screen.getByLabelText('Video title')).toHaveValue('My own title');
  });

  it('a missing thumbnail falls back to a placeholder and blocks publishing', async () => {
    setup({ api: { inspect: vi.fn().mockResolvedValue({ availability: 'unknown' }) } });
    type('YouTube video URL', `https://youtu.be/${ID}`);
    const preview = screen.getByTestId('video-preview');
    fireEvent.error(preview.querySelector('img'));
    const hq = preview.querySelector('img');
    expect(hq.getAttribute('src')).toBe(`https://img.youtube.com/vi/${ID}/hqdefault.jpg`);
    Object.defineProperty(hq, 'naturalWidth', { value: 120 });
    fireEvent.load(hq);
    expect(screen.getByTestId('yt-thumb-fallback')).toBeInTheDocument();
    await waitFor(() => expect(status()).toMatch(/cannot find a public video/));
    expect(publishButton()).toBeDisabled();
  });

  it('previews in a privacy-enhanced, sandboxed embed only when asked', () => {
    setup();
    type('YouTube video URL', `https://www.youtube.com/shorts/${ID}`);
    expect(document.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Preview video' }));
    const frame = document.querySelector('iframe');
    expect(frame.getAttribute('src')).toMatch(new RegExp(`^https://www\\.youtube-nocookie\\.com/embed/${ID}\\?`));
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
    expect(frame.hasAttribute('allowfullscreen')).toBe(true);
  });

  it('publishes with trimmed fields; a draft does not publish; an unavailable video can only be a draft', async () => {
    const { api, onSaved } = setup();
    type('YouTube video URL', `  https://youtu.be/${ID}  `);
    await waitFor(() => expect(status()).toMatch(/Valid/));
    type('Video title', '  Welcome  ');
    fireEvent.click(screen.getByLabelText('Open on YouTube'));
    fireEvent.click(publishButton());
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith({
        provider: 'youtube',
        url: `https://youtu.be/${ID}`,
        title: 'Welcome',
        description: '',
        playbackMode: 'external',
        isPublished: true,
        expectedUpdatedAt: null,
      })
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ videoId: ID }), 'publish'));
    cleanup();

    const draft = setup();
    type('YouTube video URL', `https://youtu.be/${ID}`);
    await waitFor(() => expect(status()).toMatch(/Valid/));
    fireEvent.click(screen.getByRole('button', { name: /Save as draft/ }));
    await waitFor(() => expect(draft.api.save).toHaveBeenCalledWith(expect.objectContaining({ isPublished: false })));
    cleanup();

    setup({ api: { inspect: vi.fn().mockResolvedValue({ availability: 'unavailable' }) } });
    type('YouTube video URL', `https://youtu.be/${ID}`);
    await waitFor(() => expect(status()).toMatch(/cannot find a public video/));
    expect(publishButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: /Save as draft/ })).toBeEnabled();
  });

  it('warns when embedding is disabled but still allows publishing', async () => {
    setup({ api: { inspect: vi.fn().mockResolvedValue({ availability: 'restricted' }) } });
    type('YouTube video URL', `https://youtu.be/${ID}`);
    await waitFor(() => expect(status()).toMatch(/embedding is disabled/));
    expect(publishButton()).toBeEnabled();
  });
});

describe('LessonVideoEditor - Google Drive', () => {
  it('explains sharing, accepts a file link, and previews it from the file id', async () => {
    const { api } = setup({
      tab: 'Google Drive link',
      api: { inspect: vi.fn().mockResolvedValue({ provider: 'google_drive', availability: 'available', title: 'Week 3.mp4' }) },
    });
    expect(screen.getByTestId('link-form-google_drive')).toHaveTextContent(/Anyone with the link/);
    type('Google Drive sharing link', 'https://youtu.be/dQw4w9WgXcQ');
    expect(status()).toMatch(/Only Google Drive links/);
    type('Google Drive sharing link', `https://drive.google.com/open?id=${DRIVE}`);
    await waitFor(() => expect(status()).toMatch(/anyone with the link can watch/));
    expect(api.inspect).toHaveBeenCalledWith(`https://drive.google.com/open?id=${DRIVE}`, expect.objectContaining({ provider: 'google_drive' }));
    expect(screen.getByLabelText('Video title')).toHaveValue('Week 3.mp4');
    fireEvent.click(screen.getByRole('button', { name: 'Preview video' }));
    const frame = document.querySelector('iframe');
    expect(frame.getAttribute('src')).toBe(`https://drive.google.com/file/d/${DRIVE}/preview`);
    fireEvent.click(publishButton());
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google_drive', isPublished: true })));
  });

  it('flags a deleted file (no publishing) and a file that is not a video', async () => {
    setup({ tab: 'Google Drive link', api: { inspect: vi.fn().mockResolvedValue({ provider: 'google_drive', availability: 'unavailable' }) } });
    type('Google Drive sharing link', `https://drive.google.com/file/d/${DRIVE}/view`);
    await waitFor(() => expect(status()).toMatch(/cannot find this file/));
    expect(publishButton()).toBeDisabled();
    cleanup();

    setup({ tab: 'Google Drive link', api: { inspect: vi.fn().mockResolvedValue({ provider: 'google_drive', availability: 'available', title: 'notes.pdf', notVideo: true }) } });
    type('Google Drive sharing link', `https://drive.google.com/file/d/${DRIVE}/view`);
    await waitFor(() => expect(status()).toMatch(/does not look like a video/));
  });
});

describe('LessonVideoEditor - current video, uploads and conflicts', () => {
  const youtube = {
    provider: 'youtube',
    videoId: ID,
    originalUrl: `https://youtu.be/${ID}`,
    title: 'Welcome',
    description: '',
    playbackMode: 'embed',
    isPublished: true,
    availability: 'available',
    updatedAt: '2026-11-01T10:00:00Z',
    updatedBy: { portal: 'teacher', name: 'Alice Rao' },
  };

  it('shows who changed it; unpublish and edit title use the opened version; remove needs confirming', async () => {
    const { api, onRemoved, onSaved } = setup({ lessonOverride: { video: youtube }, tab: null });
    expect(api.inspect).not.toHaveBeenCalled();
    const current = screen.getByTestId('current-video');
    expect(current).toHaveTextContent(/by Alice Rao \(teacher\)/);
    expect(current).toHaveTextContent('Published · students see it');
    expect(screen.getByRole('tab', { name: /YouTube link/ })).toHaveAttribute('aria-selected', 'true');
    // Nothing changed yet, so there is nothing to re-publish.
    expect(screen.getByRole('button', { name: /Replace and publish/ })).toBeDisabled();

    fireEvent.click(within(current).getByRole('button', { name: /Unpublish/ }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ isPublished: false, expectedUpdatedAt: '2026-11-01T10:00:00Z' }));
    expect(onSaved).toHaveBeenCalledWith(expect.anything(), 'unpublish');

    fireEvent.click(within(current).getByRole('button', { name: /Edit title/ }));
    fireEvent.change(within(current).getByLabelText('Title'), { target: { value: '  Better title ' } });
    fireEvent.click(within(current).getByRole('button', { name: /Save details/ }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith({ title: 'Better title', description: '', expectedUpdatedAt: '2026-11-01T10:00:00Z' }));

    fireEvent.click(within(current).getByRole('button', { name: /Remove video/ }));
    expect(api.remove).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Yes, remove/ }));
    });
    expect(api.remove).toHaveBeenCalledWith({ expectedUpdatedAt: '2026-11-01T10:00:00Z' });
    expect(onRemoved).toHaveBeenCalled();
  });

  it('on a version conflict, saves nothing and offers the current version (either portal’s error shape)', async () => {
    for (const shape of ['details', 'errors']) {
      const current = { provider: 'youtube', videoId: ID, title: 'Their title', updatedAt: '2026-11-02T00:00:00Z' };
      const save = vi.fn().mockRejectedValue(
        Object.assign(new Error('This video was changed by Alice Rao since you opened it.'), { status: 409, code: 'VIDEO_CHANGED', [shape]: { current } })
      );
      const { onConflict } = setup({ api: { save, inspect: vi.fn().mockResolvedValue({ availability: 'available' }) } });
      type('YouTube video URL', `https://youtu.be/${ID}`);
      await waitFor(() => expect(status()).toMatch(/Valid/));
      fireEvent.click(publishButton());
      expect(await screen.findByText(/changed by Alice Rao/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Load the current version' }));
      expect(onConflict).toHaveBeenCalledWith(current);
      cleanup();
    }
  });

  it('an uploaded video shows its file facts and plays from its signed URL', () => {
    const upload = {
      provider: 'upload',
      fileName: 'lecture.mkv',
      fileSize: 5 * 1024 ** 3,
      duration: 3725,
      uploadStatus: 'completed',
      processingStatus: 'verified',
      uploadedAt: '2026-11-20T09:30:00Z',
      title: 'Lecture',
      isPublished: false,
      availability: 'available',
      updatedAt: '2026-11-20T09:30:00Z',
      updatedBy: { portal: 'admin', name: 'Asha' },
      streamUrl: 'https://r2.test/signed?X-Amz-Signature=x',
    };
    setup({ lessonOverride: { video: upload }, tab: null });
    const current = screen.getByTestId('current-video');
    expect(current).toHaveTextContent('lecture.mkv');
    expect(current).toHaveTextContent('5.0 GB');
    expect(current).toHaveTextContent('1:02:05');
    expect(current).toHaveTextContent('Draft · hidden from students');
    expect(current.querySelector('video').getAttribute('src')).toBe(upload.streamUrl);
    expect(screen.getByRole('tab', { name: /Upload video/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('warns about MKV, refuses an oversize file, and offers to resume an unfinished upload of the same file', async () => {
    setup({ tab: null });
    const big = new File([new Uint8Array(8)], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(big, 'size', { value: 2 * 1024 ** 3 });
    fireEvent.change(screen.getByTestId('video-file-input'), { target: { files: [big] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/upload limit is 1.0 GB/);

    const mkv = new File([new Uint8Array(8)], 'class.mkv', { type: '', lastModified: 5 });
    window.localStorage.setItem('nalanda.videoUpload.admin:prarambh:m:mod-1', JSON.stringify({ uploadId: 'u9', fingerprint: 'class.mkv|8|5' }));
    fireEvent.change(screen.getByTestId('video-file-input'), { target: { files: [mkv] } });
    expect(await screen.findByText(/not in Safari or on iPhones/)).toBeInTheDocument();
    expect(screen.getByTestId('resume-notice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume upload' })).toBeEnabled();
  });

  it('when someone else changed the module during an upload, the uploader chooses', async () => {
    const theirs = { provider: 'youtube', videoId: ID, title: 'Theirs', updatedAt: '2026-11-21T09:00:00Z', updatedBy: { portal: 'teacher', name: 'Tara' } };
    class OkXHR {
      constructor() {
        this.upload = {};
      }
      open() {}
      send(blob) {
        setTimeout(() => {
          this.upload.onprogress?.({ lengthComputable: true, loaded: blob.size });
          this.status = 200;
          this.onload?.();
        }, 0);
      }
      abort() {}
    }
    vi.stubGlobal('XMLHttpRequest', OkXHR);
    const complete = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('changed'), { status: 409, code: 'VIDEO_CHANGED', errors: { current: theirs, uploadId: 'u1', uploadStatus: 'verified' } }))
      .mockResolvedValueOnce({ status: 'completed', video: { provider: 'upload', fileName: 'mine.mp4', isPublished: true } });
    const { api, onSaved } = setup({
      tab: null,
      api: {
        startUpload: vi.fn().mockResolvedValue({ uploadId: 'u1', partSize: 10, totalParts: 1 }),
        partUrls: vi.fn().mockResolvedValue({ parts: [{ partNumber: 1, url: 'https://r2.test/p1' }] }),
        complete,
      },
    });
    fireEvent.change(screen.getByTestId('video-file-input'), { target: { files: [new File([new Uint8Array(6)], 'mine.mp4', { type: 'video/mp4' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Upload video' }));
    const banner = await screen.findByTestId('upload-conflict');
    expect(banner).toHaveTextContent(/Tara \(teacher\)/);
    fireEvent.click(within(banner).getByRole('button', { name: /Replace it with my upload/ }));
    await waitFor(() => expect(complete).toHaveBeenLastCalledWith('u1', { expectedUpdatedAt: '2026-11-21T09:00:00Z' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ provider: 'upload' }), 'publish'));
    expect(api.abortUpload).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
