import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within, act } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import LessonVideoManager from './LessonVideoManager';

const ID = 'dQw4w9WgXcQ';
const DRIVE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';

const uploaded = (over = {}) => ({
  provider: 'upload',
  fileName: 'module-1.mp4',
  fileSize: 104857600,
  duration: 600,
  uploadStatus: 'completed',
  processingStatus: 'verified',
  uploadedAt: '2026-11-20T09:00:00Z',
  title: 'Orientation',
  isPublished: true,
  availability: 'available',
  updatedAt: '2026-11-20T09:00:00Z',
  updatedBy: { portal: 'teacher', name: 'Tara' },
  streamUrl: 'https://r2.test/signed',
  ...over,
});

function course(over = {}) {
  return {
    slug: 'prarambh',
    title: 'PRARAMBH',
    uploadsEnabled: true,
    maxUploadBytes: 20 * 1024 ** 3,
    modules: [
      {
        moduleId: 'mod-1',
        title: 'Module 1',
        video: uploaded(),
        activeUpload: null,
        lessons: [
          { lessonId: 'l-1', title: 'Welcome', isPublished: true, video: null, legacyVideoUrl: '' },
          {
            lessonId: 'l-2',
            title: 'Archetypes',
            isPublished: true,
            video: { provider: 'youtube', videoId: ID, originalUrl: `https://youtu.be/${ID}`, title: 'Archetypes video', isPublished: false, availability: 'available' },
            legacyVideoUrl: '',
          },
        ],
      },
      {
        moduleId: 'mod-2',
        title: 'Module 2',
        video: { provider: 'google_drive', externalVideoId: DRIVE, title: 'Mindset', isPublished: true, availability: 'restricted', updatedAt: '2026-11-19T00:00:00Z' },
        activeUpload: null,
        lessons: [],
      },
      {
        moduleId: 'mod-3',
        title: 'Module 3',
        video: null,
        activeUpload: { uploadId: 'u1', status: 'uploading', fileName: 'm3.mov', fileSize: 2e9, actor: { portal: 'teacher', name: 'Bala' } },
        lessons: [],
      },
    ],
    ...over,
  };
}

function makeApi(overrides = {}) {
  return {
    listCourses: vi.fn().mockResolvedValue([
      { slug: 'prarambh', title: 'PRARAMBH', isPublished: true },
      { slug: 'garud', title: 'GARUD', isPublished: true },
    ]),
    getCourse: vi.fn().mockImplementation(async (slug) => (slug === 'prarambh' ? course() : { slug, title: slug, uploadsEnabled: true, modules: [] })),
    listActivity: vi.fn().mockResolvedValue([
      { id: 'e1', at: '2026-11-21T08:00:00Z', courseSlug: 'prarambh', targetType: 'module', targetId: 'mod-1', action: 'upload_failed', level: 'error', video: { provider: 'upload', ref: 'bad.mp4' }, message: 'VIDEO_VERIFICATION_FAILED: not a video', actor: { portal: 'teacher', name: 'Tara' } },
    ]),
    inspect: vi.fn().mockResolvedValue({ availability: 'available', title: 'From YouTube' }),
    save: vi.fn(),
    update: vi.fn(),
    remove: vi.fn().mockResolvedValue({ removed: true }),
    startUpload: vi.fn(),
    partUrls: vi.fn(),
    resume: vi.fn(),
    complete: vi.fn(),
    abortUpload: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe('LessonVideoManager', () => {
  it('shows each module’s source, status, uploader and in-progress uploads at a glance', async () => {
    render(<LessonVideoManager api={makeApi()} heading="Module Videos" description="" emptyMessage="none" />);
    const m1 = await screen.findByTestId('module-video-mod-1');
    expect(within(m1).getByTestId('source-module-mod-1')).toHaveTextContent('Uploaded file');
    expect(m1).toHaveTextContent(/100 MB · uploaded .* by Tara \(teacher\)/);
    expect(m1).toHaveTextContent('10:00');
    expect(screen.getByTestId('source-module-mod-2')).toHaveTextContent('Google Drive');
    expect(screen.getByTestId('status-module-mod-2')).toHaveTextContent('Published · not shared publicly');
    expect(screen.getByTestId('source-module-mod-3')).toHaveTextContent('No video');
    expect(screen.getByTestId('upload-module-mod-3')).toHaveTextContent('Uploading by Bala');

    const totals = screen.getByTestId('video-totals');
    expect(within(totals).getByText('With video').nextSibling).toHaveTextContent('2');
    expect(within(totals).getByText('Without video').nextSibling).toHaveTextContent('1');
    expect(within(totals).getByText('Uploads in progress').nextSibling).toHaveTextContent('1');

    // Lesson videos are listed under their module, on demand.
    expect(screen.queryByText('Archetypes')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Lesson videos \(optional\)/ }));
    expect(screen.getByText('Archetypes')).toBeInTheDocument();
    expect(screen.getByTestId('status-l-2')).toHaveTextContent('Draft');
  });

  it('opening a module shows the editor for that module; switching course loads that course', async () => {
    const api = makeApi();
    render(<LessonVideoManager api={api} heading="Module Videos" description="" emptyMessage="none" />);
    fireEvent.click(within(await screen.findByTestId('module-video-mod-2')).getByRole('button', { name: /Manage video/ }));
    const editor = screen.getByTestId('lesson-video-editor');
    expect(editor).toHaveTextContent('Module 2');
    expect(within(editor).getByTestId('current-video')).toHaveTextContent(/Not shared publicly/);

    fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'garud' } });
    await waitFor(() => expect(api.getCourse).toHaveBeenCalledWith('garud'));
    expect(await screen.findByText(/has no modules yet/)).toBeInTheDocument();
  });

  it('removing a module video updates its row without reloading the course', async () => {
    const api = makeApi();
    render(<LessonVideoManager api={api} heading="Module Videos" description="" emptyMessage="none" />);
    fireEvent.click(within(await screen.findByTestId('module-video-mod-1')).getByRole('button', { name: /Manage video/ }));
    fireEvent.click(screen.getByRole('button', { name: /Remove video/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('prarambh', { moduleId: 'mod-1' }, { expectedUpdatedAt: '2026-11-20T09:00:00Z' }));
    expect(await screen.findByTestId('source-module-mod-1')).toHaveTextContent('No video');
    expect(api.getCourse).toHaveBeenCalledTimes(1);
  });

  it('re-reads the course on a live notice and on reconnect; ignores other courses', async () => {
    const api = makeApi();
    let push;
    let reconnect;
    const live = {
      subscribe: vi.fn((onChange, onReconnect) => {
        push = onChange;
        reconnect = onReconnect;
        return () => {};
      }),
    };
    render(<LessonVideoManager api={api} live={live} heading="Module Videos" description="" emptyMessage="none" />);
    await screen.findByTestId('module-video-mod-1');
    expect(api.getCourse).toHaveBeenCalledTimes(1);

    api.getCourse.mockResolvedValue(course({ modules: [{ ...course().modules[0], video: null }, ...course().modules.slice(1)] }));
    await act(async () => {
      push({ slug: 'prarambh', moduleId: 'mod-1', action: 'removed', actor: { portal: 'teacher', name: 'Tara' } });
    });
    await waitFor(() => expect(screen.getByTestId('source-module-mod-1')).toHaveTextContent('No video'));
    expect(screen.getByRole('status')).toHaveTextContent('Live update: Tara (teacher) removed the video');

    await act(async () => {
      push({ slug: 'garud', moduleId: 'g-1', action: 'published' });
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(api.getCourse).toHaveBeenCalledTimes(2);

    await act(async () => {
      reconnect();
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(api.getCourse).toHaveBeenCalledTimes(3);
  });

  it('shows the course’s video history, failures included', async () => {
    const api = makeApi();
    render(<LessonVideoManager api={api} heading="Module Videos" description="" emptyMessage="none" />);
    await screen.findByTestId('module-video-mod-1');
    fireEvent.click(screen.getByRole('button', { name: /Recent video activity/ }));
    const panel = screen.getByTestId('video-activity');
    await waitFor(() => expect(panel).toHaveTextContent(/Module 1 - Tara \(teacher\) upload failed “bad.mp4”/));
    expect(panel).toHaveTextContent('not a video');
    expect(api.listActivity).toHaveBeenCalledWith('prarambh');
  });

  it('shows the empty message, and a load failure instead of an empty page', async () => {
    render(<LessonVideoManager api={makeApi({ listCourses: vi.fn().mockResolvedValue([]) })} heading="H" description="" emptyMessage="No courses here." />);
    expect(await screen.findByText('No courses here.')).toBeInTheDocument();
    cleanup();
    const err = Object.assign(new Error('The Student service is unavailable, so module videos cannot be loaded.'), { status: 503 });
    render(<LessonVideoManager api={makeApi({ getCourse: vi.fn().mockRejectedValue(err) })} heading="H" description="" emptyMessage="none" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The Student service is unavailable');
  });
});
