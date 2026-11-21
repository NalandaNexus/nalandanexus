import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';

/**
 * The Teacher portal's Module Videos page, end to end in the browser layer:
 * the real manager, editor and upload engine against a mocked teacher API
 * and socket. Storage is a fake XMLHttpRequest that accepts every part.
 */

const YT = 'dQw4w9WgXcQ';
const DRIVE = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const listeners = {};

const api = {
  getLessonVideoCourses: vi.fn(),
  getLessonVideos: vi.fn(),
  getLessonVideoActivity: vi.fn(),
  inspectLessonVideo: vi.fn(),
  saveCourseVideo: vi.fn(),
  updateCourseVideo: vi.fn(),
  removeCourseVideo: vi.fn(),
  startCourseVideoUpload: vi.fn(),
  getCourseVideoPartUrls: vi.fn(),
  resumeCourseVideoUpload: vi.fn(),
  completeCourseVideoUpload: vi.fn(),
  abortCourseVideoUpload: vi.fn(),
};

vi.mock('../services/teacherApiService', () => ({ teacherApiService: api }));
vi.mock('../services/socketService', () => ({
  socketService: {
    connect: vi.fn(),
    isConnected: false,
    on: vi.fn((event, fn) => {
      listeners[event] = fn;
      return () => delete listeners[event];
    }),
  },
}));

const { default: LessonVideosPage } = await import('./LessonVideosPage');

const sentParts = [];
class FakeXHR {
  constructor() {
    this.upload = {};
    this.status = 0;
  }
  open(method, url) {
    this.url = url;
  }
  send(blob) {
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: blob.size });
      sentParts.push({ url: this.url, size: blob.size });
      this.status = 200;
      this.onload?.();
    }, 0);
  }
  abort() {
    this.onabort?.();
  }
}

const UPLOADED = {
  provider: 'upload',
  fileName: 'week-1.mp4',
  fileSize: 734003200,
  duration: 754,
  mimeType: 'video/mp4',
  uploadStatus: 'completed',
  processingStatus: 'verified',
  uploadedAt: '2026-11-20T10:00:00.000Z',
  title: 'Week one',
  description: '',
  isPublished: true,
  availability: 'available',
  updatedAt: '2026-11-20T10:00:00.000Z',
  updatedBy: { portal: 'teacher', name: 'Tara' },
  streamUrl: 'https://storage.test/signed',
};

function course({ m1 = null, m2 = null } = {}) {
  return {
    slug: 'garud',
    title: 'GARUD',
    uploadsEnabled: true,
    maxUploadBytes: 20 * 1024 ** 3,
    modules: [
      { moduleId: 'g-mod-1', title: 'Module 1: Flight', video: m1, activeUpload: null, lessons: [{ lessonId: 'g-1', title: 'Lift-off', isPublished: true, video: null, legacyVideoUrl: '' }] },
      { moduleId: 'g-mod-2', title: 'Module 2: Wings', video: m2, activeUpload: null, lessons: [] },
    ],
  };
}

const moduleRow = async (id = 'g-mod-1') => screen.findByTestId(`module-video-${id}`);

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  for (const k of Object.keys(listeners)) delete listeners[k];
  sentParts.length = 0;
  window.localStorage.clear();
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  api.getLessonVideoCourses.mockResolvedValue([{ slug: 'garud', title: 'GARUD', isPublished: true }]);
  api.getLessonVideos.mockResolvedValue(course());
  api.getLessonVideoActivity.mockResolvedValue([]);
  api.saveCourseVideo.mockImplementation(async (slug, target, p) => ({
    video: {
      provider: p.provider,
      videoId: p.provider === 'youtube' ? YT : null,
      externalVideoId: p.provider === 'google_drive' ? DRIVE : null,
      originalUrl: p.url,
      title: p.title,
      isPublished: p.isPublished,
      availability: 'available',
      updatedAt: '2026-11-21T10:00:00.000Z',
    },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Teacher Module Videos page', () => {
  it('shows only assigned courses, and which modules have no video yet', async () => {
    api.getLessonVideos.mockResolvedValue(course({ m2: UPLOADED }));
    render(<LessonVideosPage />);
    expect(await screen.findByText('Module 1: Flight')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Course')).getAllByRole('option').map((o) => o.value)).toEqual(['garud']);
    expect(screen.getByTestId('source-module-g-mod-1')).toHaveTextContent('No video');
    expect(screen.getByTestId('source-module-g-mod-2')).toHaveTextContent('Uploaded file');
    expect(screen.getByTestId('status-module-g-mod-2')).toHaveTextContent('Published');
    expect(screen.getByTestId('module-video-g-mod-2')).toHaveTextContent(/uploaded .* by Tara \(teacher\)/);
    const totals = screen.getByTestId('video-totals');
    expect(within(totals).getByText('Without video').nextSibling).toHaveTextContent('1');

    fireEvent.click(screen.getByLabelText('Show only modules without a video'));
    expect(screen.queryByText('Module 2: Wings')).not.toBeInTheDocument();
    expect(screen.getByText('Module 1: Flight')).toBeInTheDocument();
  });

  it('adds a YouTube link to a module and publishes it', async () => {
    api.inspectLessonVideo.mockResolvedValue({ provider: 'youtube', availability: 'available', title: 'Flight basics' });
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video: Module 1/ }));
    fireEvent.click(screen.getByRole('tab', { name: /YouTube link/ }));
    fireEvent.change(screen.getByLabelText('YouTube video URL'), { target: { value: `https://youtube.com/shorts/${YT}` } });
    await waitFor(() => expect(screen.getByTestId('video-status')).toHaveTextContent(/Valid YouTube video/));
    expect(api.inspectLessonVideo).toHaveBeenCalledWith(`https://youtube.com/shorts/${YT}`, expect.objectContaining({ provider: 'youtube' }));
    expect(screen.getByLabelText('Video title')).toHaveValue('Flight basics');
    fireEvent.click(screen.getByRole('button', { name: /^Publish$/ }));
    await waitFor(() =>
      expect(api.saveCourseVideo).toHaveBeenCalledWith(
        'garud',
        { moduleId: 'g-mod-1' },
        expect.objectContaining({ provider: 'youtube', url: `https://youtube.com/shorts/${YT}`, isPublished: true, expectedUpdatedAt: null })
      )
    );
    expect(await screen.findByTestId('source-module-g-mod-1')).toHaveTextContent('YouTube');
    expect(screen.getByRole('status')).toHaveTextContent(/video published/);
  });

  it('adds a Google Drive link, explaining sharing and a file that is not public', async () => {
    api.inspectLessonVideo.mockResolvedValue({ provider: 'google_drive', availability: 'restricted', title: null });
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Google Drive link/ }));
    expect(screen.getByTestId('link-form-google_drive')).toHaveTextContent(/Anyone with the link/);

    fireEvent.change(screen.getByLabelText('Google Drive sharing link'), { target: { value: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWx' } });
    expect(screen.getByTestId('video-status')).toHaveTextContent(/folder/);
    expect(screen.getByRole('button', { name: /^Publish$/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Google Drive sharing link'), { target: { value: `https://drive.google.com/file/d/${DRIVE}/view?usp=sharing` } });
    await waitFor(() => expect(screen.getByTestId('video-status')).toHaveTextContent(/not shared publicly/));
    expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('link-form-google_drive')).getByRole('button', { name: 'Preview video' }));
    expect(screen.getByTitle('Video preview').getAttribute('src')).toBe(`https://drive.google.com/file/d/${DRIVE}/preview`);

    fireEvent.click(screen.getByRole('button', { name: /^Publish$/ }));
    await waitFor(() => expect(api.saveCourseVideo).toHaveBeenCalledWith('garud', { moduleId: 'g-mod-1' }, expect.objectContaining({ provider: 'google_drive', isPublished: true })));
  });

  it('uploads a file in parts with progress, and the module shows it once verified', async () => {
    api.startCourseVideoUpload.mockResolvedValue({ uploadId: 'u1', partSize: 10, totalParts: 3, status: 'uploading' });
    api.getCourseVideoPartUrls.mockImplementation(async (slug, id, numbers) => ({ parts: numbers.map((n) => ({ partNumber: n, url: `https://storage.test/${id}/${n}` })) }));
    api.completeCourseVideoUpload.mockResolvedValue({ status: 'completed', video: { ...UPLOADED, fileName: 'week-1.mp4', fileSize: 25 } });
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video/ }));
    expect(screen.getByRole('tab', { name: /Upload video/ })).toHaveAttribute('aria-selected', 'true');

    const file = new File([new Uint8Array(25)], 'week-1.mp4', { type: 'video/mp4', lastModified: 1 });
    fireEvent.change(screen.getByTestId('video-file-input'), { target: { files: [file] } });
    expect(await screen.findByTestId('selected-file')).toHaveTextContent('week-1.mp4');
    expect(screen.getByLabelText('Video title')).toHaveValue('week-1');
    fireEvent.click(screen.getByRole('button', { name: 'Upload video' }));

    await waitFor(() => expect(api.completeCourseVideoUpload).toHaveBeenCalled());
    expect(api.startCourseVideoUpload).toHaveBeenCalledWith(
      'garud',
      { moduleId: 'g-mod-1' },
      expect.objectContaining({ fileName: 'week-1.mp4', fileSize: 25, mimeType: 'video/mp4', isPublished: true, expectedUpdatedAt: null })
    );
    expect(api.getCourseVideoPartUrls).toHaveBeenCalledWith('garud', 'u1', [1, 2, 3]);
    expect(sentParts.map((p) => p.size).sort()).toEqual([10, 10, 5]);
    expect(api.completeCourseVideoUpload).toHaveBeenCalledWith('garud', 'u1', {});
    expect(await screen.findByTestId('source-module-g-mod-1')).toHaveTextContent('Uploaded file');
  });

  it('refuses a non-video file before anything is sent', async () => {
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video/ }));
    fireEvent.change(screen.getByTestId('video-file-input'), { target: { files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/MP4, MOV, WEBM or MKV/);
    expect(screen.getByRole('button', { name: 'Upload video' })).toBeDisabled();
    expect(api.startCourseVideoUpload).not.toHaveBeenCalled();
  });

  it('a failed upload can be retried', async () => {
    api.startCourseVideoUpload
      .mockRejectedValueOnce(Object.assign(new Error('The server took too long to respond. Please try again.'), { status: 0, code: 'TIMEOUT' }))
      .mockResolvedValueOnce({ uploadId: 'u2', partSize: 10, totalParts: 1, status: 'uploading' });
    api.getCourseVideoPartUrls.mockImplementation(async (slug, id, numbers) => ({ parts: numbers.map((n) => ({ partNumber: n, url: `https://storage.test/${id}/${n}` })) }));
    api.completeCourseVideoUpload.mockResolvedValue({ status: 'completed', video: { ...UPLOADED, fileSize: 8 } });
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video/ }));
    fireEvent.change(screen.getByTestId('video-file-input'), { target: { files: [new File([new Uint8Array(8)], 'a.mov', { type: 'video/quicktime' })] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Upload video' }));
    expect(await screen.findByTestId('upload-error')).toHaveTextContent(/took too long/);
    expect(screen.getByTestId('upload-phase')).toHaveTextContent('Upload failed');
    fireEvent.click(screen.getByRole('button', { name: /Retry upload/ }));
    await waitFor(() => expect(api.completeCourseVideoUpload).toHaveBeenCalledWith('garud', 'u2', {}));
    expect(await screen.findByTestId('source-module-g-mod-1')).toHaveTextContent('Uploaded file');
  });

  it('an existing upload can be unpublished, and removed only after confirming', async () => {
    api.getLessonVideos.mockResolvedValue(course({ m1: UPLOADED }));
    api.updateCourseVideo.mockResolvedValue({ video: { ...UPLOADED, isPublished: false, updatedAt: '2026-11-21T11:00:00.000Z' } });
    api.removeCourseVideo.mockResolvedValue({ removed: true });
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Manage video/ }));
    const current = screen.getByTestId('current-video');
    expect(current).toHaveTextContent('week-1.mp4');
    expect(current).toHaveTextContent('700 MB');
    expect(current).toHaveTextContent('12:34');
    expect(current).toHaveTextContent('Upload complete · file verified');
    expect(within(current).getByLabelText('Week one').getAttribute('src')).toBe('https://storage.test/signed');

    fireEvent.click(within(current).getByRole('button', { name: /Unpublish/ }));
    await waitFor(() =>
      expect(api.updateCourseVideo).toHaveBeenCalledWith('garud', { moduleId: 'g-mod-1' }, { isPublished: false, expectedUpdatedAt: UPLOADED.updatedAt })
    );
    expect(await screen.findByTestId('status-module-g-mod-1')).toHaveTextContent('Draft');

    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Manage video/ }));
    fireEvent.click(screen.getByRole('button', { name: /Remove video/ }));
    expect(api.removeCourseVideo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(api.removeCourseVideo).toHaveBeenCalledWith('garud', { moduleId: 'g-mod-1' }, { expectedUpdatedAt: '2026-11-21T11:00:00.000Z' }));
    expect(await screen.findByTestId('source-module-g-mod-1')).toHaveTextContent('No video');
  });

  it('replacing a video sends the version it replaces, and a conflict saves nothing', async () => {
    api.getLessonVideos.mockResolvedValue(course({ m1: UPLOADED }));
    api.inspectLessonVideo.mockResolvedValue({ provider: 'youtube', availability: 'available', title: 'New' });
    api.saveCourseVideo.mockRejectedValue(
      Object.assign(new Error('This video was changed by Asha since you opened it.'), { status: 409, code: 'VIDEO_CHANGED', details: { current: { ...UPLOADED, title: 'Asha cut' } } })
    );
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Manage video/ }));
    fireEvent.click(screen.getByRole('tab', { name: /YouTube link/ }));
    fireEvent.change(screen.getByLabelText('YouTube video URL'), { target: { value: `https://youtu.be/${YT}` } });
    await waitFor(() => expect(screen.getByTestId('video-status')).toHaveTextContent(/Valid/));
    fireEvent.click(screen.getByRole('button', { name: /Replace and publish/ }));
    await waitFor(() => expect(api.saveCourseVideo).toHaveBeenCalledWith('garud', { moduleId: 'g-mod-1' }, expect.objectContaining({ expectedUpdatedAt: UPLOADED.updatedAt })));
    expect(await screen.findByText(/changed by Asha/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load the current version' })).toBeInTheDocument();
  });

  it('shows another editor’s change live, and warns an open editor instead of overwriting', async () => {
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video/ }));
    api.getLessonVideos.mockResolvedValue(course({ m1: { ...UPLOADED, updatedBy: { portal: 'admin', name: 'Asha' } } }));
    await act(async () => {
      listeners['course_video.changed']({ slug: 'garud', moduleId: 'g-mod-1', action: 'upload_completed', actor: { portal: 'admin', name: 'Asha' } });
    });
    await waitFor(() => expect(screen.getByTestId('source-module-g-mod-1')).toHaveTextContent('Uploaded file'));
    expect(screen.getByText(/Live update: Asha \(admin\) uploaded a new video/)).toBeInTheDocument();
    // The editor stayed open and says what happened.
    expect(screen.getByTestId('lesson-video-editor')).toHaveTextContent(/just changed by Asha \(admin\)/);
    expect(screen.getByRole('button', { name: /Continue from the latest version/ })).toBeInTheDocument();

    // A notice about another course reloads only the course list.
    const calls = api.getLessonVideos.mock.calls.length;
    await act(async () => {
      listeners['course_video.changed']({ slug: 'yoddha', moduleId: 'y-1', action: 'published' });
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(api.getLessonVideos.mock.calls.length).toBe(calls);
  });

  it('reloads the course list in place when an administrator changes assignments', async () => {
    render(<LessonVideosPage />);
    await moduleRow();
    api.getLessonVideoCourses.mockResolvedValue([]);
    await act(async () => {
      listeners['course.access_changed']({ added: [], removed: ['garud'] });
    });
    expect(await screen.findByText(/No courses have been assigned to you yet/)).toBeInTheDocument();
  });

  it('surfaces a refusal from the backend', async () => {
    api.inspectLessonVideo.mockResolvedValue({ provider: 'youtube', availability: 'available' });
    api.saveCourseVideo.mockRejectedValue(Object.assign(new Error('This course has not been assigned to you, so you cannot manage its videos.'), { status: 403 }));
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video/ }));
    fireEvent.click(screen.getByRole('tab', { name: /YouTube link/ }));
    fireEvent.change(screen.getByLabelText('YouTube video URL'), { target: { value: `https://youtu.be/${YT}` } });
    await waitFor(() => expect(screen.getByTestId('video-status')).toHaveTextContent(/Valid/));
    fireEvent.click(screen.getByRole('button', { name: /^Publish$/ }));
    expect(await screen.findByText(/has not been assigned to you/)).toBeInTheDocument();
  });

  it('without configured storage, the upload tab explains and links still work', async () => {
    api.getLessonVideos.mockResolvedValue({ ...course(), uploadsEnabled: false });
    render(<LessonVideosPage />);
    fireEvent.click(within(await moduleRow()).getByRole('button', { name: /Add video/ }));
    expect(screen.getByRole('tab', { name: /YouTube link/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /Upload video/ }));
    expect(screen.getByTestId('uploads-disabled')).toHaveTextContent(/not been configured/);
  });
});
