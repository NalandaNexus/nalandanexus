import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const ID_A = 'dQw4w9WgXcQ';
const ID_B = 'M7lc1UVf-VE';

const handlers = {};
const ioHandlers = {};
const fakeSocket = {
  on: vi.fn((event, fn) => {
    handlers[event] = fn;
  }),
  off: vi.fn((event) => {
    delete handlers[event];
  }),
  io: {
    on: vi.fn((event, fn) => {
      ioHandlers[event] = fn;
    }),
    off: vi.fn((event) => {
      delete ioHandlers[event];
    }),
  },
};

const getEnrolledCourseContent = vi.fn();
const markLessonComplete = vi.fn();

vi.mock('../../services/courseService', () => ({
  courseService: {
    getEnrolledCourseContent: (...a) => getEnrolledCourseContent(...a),
    markLessonComplete: (...a) => markLessonComplete(...a),
  },
}));
vi.mock('../../services/socket', () => ({
  onSocketReady: (fn) => {
    fn(fakeSocket);
    return () => {};
  },
}));
vi.mock('../../context/StudentContext', () => ({ useStudent: () => ({ refreshData: vi.fn() }) }));

const { default: ParambhCoursePage } = await import('./ParambhCoursePage');

const yt = (id, over = {}) => ({
  provider: 'youtube',
  videoId: id,
  title: `Video ${id}`,
  description: '',
  playbackMode: 'embed',
  embeddable: true,
  ...over,
});

function content({ l1 = {}, l2 = {}, courseVideoUrl = '' } = {}) {
  return {
    id: 'c1',
    slug: 'prarambh',
    title: 'PRARAMBH',
    subtitle: '',
    bannerImage: '',
    videoUrl: courseVideoUrl,
    progress: 10,
    modules: [
      {
        moduleId: 'mod-1',
        title: 'Awakening',
        order: 1,
        lessons: [
          { lessonId: 'l-1', title: 'Welcome', order: 1, duration: '10 mins', video: yt(ID_A), videoUrl: '', videoManaged: true, summary: 'Hello', content: 'Read this.', completed: false, isCurrent: true, ...l1 },
          { lessonId: 'l-2', title: 'Written lesson', order: 2, duration: '5 mins', video: null, videoUrl: '', videoManaged: false, summary: '', content: 'Only text.', completed: false, ...l2 },
        ],
      },
    ],
  };
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/student/course/prarambh']}>
      <Routes>
        <Route path="/student/course/:slug" element={<ParambhCoursePage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  getEnrolledCourseContent.mockReset();
  markLessonComplete.mockReset();
  for (const k of Object.keys(handlers)) delete handlers[k];
  for (const k of Object.keys(ioHandlers)) delete ioHandlers[k];
});
afterEach(cleanup);

describe('Student lesson page', () => {
  it('shows the published YouTube video thumbnail-first, and plays it in the page', async () => {
    getEnrolledCourseContent.mockResolvedValue(content());
    renderPage();
    const player = await screen.findByTestId('lesson-video-player');
    expect(player.querySelector('img').getAttribute('src')).toContain(`/vi/${ID_A}/`);
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('video')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Play video/ }));
    expect(document.querySelector('iframe').getAttribute('src')).toContain(`youtube-nocookie.com/embed/${ID_A}`);
    // The lesson around the player is intact.
    expect(screen.getByText('Read this.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Lesson Complete/ })).toBeEnabled();
  });

  it('a lesson in a module with no video says so - no player, no broken thumbnail - and keeps notes and completion', async () => {
    getEnrolledCourseContent.mockResolvedValue(content({ courseVideoUrl: '' }));
    renderPage();
    await screen.findByTestId('lesson-video-player');
    fireEvent.click(screen.getByRole('button', { name: /Written lesson/ }));
    expect(screen.queryByTestId('lesson-video-player')).toBeNull();
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByTestId('no-module-video')).toHaveTextContent('No video has been uploaded for this module yet. Please check back later.');
    expect(screen.getByText('Only text.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Take Notes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark Lesson Complete/ })).toBeEnabled();
  });

  it('a lesson whose video is still a draft does not fall back to an unrelated file', async () => {
    getEnrolledCourseContent.mockResolvedValue(content({ l1: { video: null, videoManaged: true } }));
    renderPage();
    await screen.findByText('Read this.');
    expect(screen.queryByTestId('lesson-video-player')).toBeNull();
    expect(document.querySelector('video')).toBeNull();
    expect(screen.getByTestId('no-module-video')).toBeInTheDocument();
  });

  it('never falls back to a course-wide video - the way one fixed video used to play on every lesson', async () => {
    getEnrolledCourseContent.mockResolvedValue(content({ courseVideoUrl: '/PRARAMBH.mp4', l1: { video: null, videoManaged: false, videoUrl: '' } }));
    renderPage();
    await screen.findByText('Read this.');
    expect(document.querySelector('video')).toBeNull();
    expect(document.body.innerHTML).not.toContain('PRARAMBH.mp4');
    expect(screen.getByTestId('no-module-video')).toBeInTheDocument();
  });

  it('an unmanaged lesson keeps its directly-hosted file, as before', async () => {
    getEnrolledCourseContent.mockResolvedValue(content({ l1: { video: null, videoManaged: false, videoUrl: '/lesson.mp4' } }));
    renderPage();
    await screen.findByText('Read this.');
    expect(document.querySelector('video').getAttribute('src')).toBe('/lesson.mp4');
  });

  it('picks up a changed video live, without leaving the lesson the student is on', async () => {
    getEnrolledCourseContent.mockResolvedValueOnce(content());
    renderPage();
    await screen.findByTestId('lesson-video-player');
    fireEvent.click(screen.getByRole('button', { name: /Written lesson/ }));
    fireEvent.click(screen.getByRole('button', { name: /Welcome/ }));

    // An administrator swaps l-1's video and adds one to l-2.
    getEnrolledCourseContent.mockResolvedValueOnce(content({ l1: { video: yt(ID_B) }, l2: { video: yt(ID_A), videoManaged: true } }));
    expect(handlers['course:content_updated']).toBeTypeOf('function');
    await act(async () => {
      handlers['course:content_updated']({ slug: 'prarambh', lessonId: 'l-1' });
    });
    await waitFor(() => expect(screen.getByTestId('lesson-video-player').querySelector('img').getAttribute('src')).toContain(`/vi/${ID_B}/`));
    expect(screen.getByText('Read this.')).toBeInTheDocument();

    // Unpublished: the player goes away.
    getEnrolledCourseContent.mockResolvedValueOnce(content({ l1: { video: null, videoManaged: true } }));
    await act(async () => {
      handlers['course:content_updated']({ slug: 'prarambh', lessonId: 'l-1' });
    });
    await waitFor(() => expect(screen.queryByTestId('lesson-video-player')).toBeNull());
  });

  it('ignores updates for other courses', async () => {
    getEnrolledCourseContent.mockResolvedValue(content());
    renderPage();
    await screen.findByTestId('lesson-video-player');
    const calls = getEnrolledCourseContent.mock.calls.length;
    await act(async () => {
      handlers['course:content_updated']({ slug: 'garud', lessonId: 'g-1' });
    });
    expect(getEnrolledCourseContent.mock.calls.length).toBe(calls);
  });

  it('a module video plays from the syllabus, with no completion button, and lessons still work', async () => {
    const c = content();
    c.modules[0].video = yt(ID_B, { title: 'Welcome to the Awakening', description: 'What this module covers.' });
    getEnrolledCourseContent.mockResolvedValue(c);
    renderPage();
    await screen.findByTestId('lesson-video-player');
    fireEvent.click(screen.getByRole('button', { name: /Module video/ }));
    const player = screen.getByTestId('lesson-video-player');
    expect(player.querySelector('img').getAttribute('src')).toContain(`/vi/${ID_B}/`);
    expect(screen.getByText('What this module covers.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Lesson Complete/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start the first lesson' }));
    expect(screen.getByTestId('lesson-video-player').querySelector('img').getAttribute('src')).toContain(`/vi/${ID_A}/`);
    expect(screen.getByRole('button', { name: /Mark Lesson Complete/ })).toBeInTheDocument();
  });

  it('a module without a video shows no module-video entry', async () => {
    getEnrolledCourseContent.mockResolvedValue(content());
    renderPage();
    await screen.findByTestId('lesson-video-player');
    expect(screen.queryByRole('button', { name: /Module video/ })).toBeNull();
  });

  it("a lesson without its own video plays its module's video, whatever the source", async () => {
    const c = content({ l1: { video: null, videoManaged: false } });
    c.modules[0].video = {
      provider: 'upload',
      title: 'Module 1 lecture',
      description: '',
      duration: 754,
      mimeType: 'video/mp4',
      uploadedAt: '2026-11-21T10:00:00.000Z',
      streamUrl: 'https://r2.test/v.mp4?X-Amz-Signature=a',
      streamExpiresAt: '2026-11-21T12:00:00.000Z',
    };
    getEnrolledCourseContent.mockResolvedValue(c);
    renderPage();
    const wrapper = await screen.findByTestId('module-video');
    expect(wrapper).toHaveTextContent('Module video · Awakening');
    expect(wrapper.querySelector('video').getAttribute('src')).toBe('https://r2.test/v.mp4?X-Amz-Signature=a');
    // The written lesson in the same module shares it.
    fireEvent.click(screen.getByRole('button', { name: /Written lesson/ }));
    expect(screen.getByTestId('module-video').querySelector('video')).not.toBeNull();
    expect(screen.queryByTestId('no-module-video')).toBeNull();
  });

  it('an expired upload link is refreshed from the course API, in place', async () => {
    const withUpload = (url) => {
      const c = content({ l1: { video: { provider: 'upload', title: 'Lecture', streamUrl: url, uploadedAt: '2026-11-21T10:00:00.000Z' }, videoManaged: true } });
      return c;
    };
    getEnrolledCourseContent.mockResolvedValueOnce(withUpload('https://r2.test/a?sig=1')).mockResolvedValueOnce(withUpload('https://r2.test/a?sig=2'));
    renderPage();
    const player = await screen.findByTestId('lesson-video-player');
    const first = player.querySelector('video');
    await act(async () => {
      fireEvent.error(first);
    });
    await waitFor(() => expect(screen.getByTestId('lesson-video-player').querySelector('video').getAttribute('src')).toBe('https://r2.test/a?sig=2'));
    // Same element, same lesson: the student is not moved or reloaded.
    expect(screen.getByTestId('lesson-video-player').querySelector('video')).toBe(first);
    expect(getEnrolledCourseContent).toHaveBeenCalledTimes(2);
  });

  it('a reconnect re-reads the course, catching changes missed while offline', async () => {
    getEnrolledCourseContent.mockResolvedValue(content());
    renderPage();
    await screen.findByTestId('lesson-video-player');
    expect(ioHandlers.reconnect).toBeTypeOf('function');
    await act(async () => {
      ioHandlers.reconnect();
    });
    expect(getEnrolledCourseContent).toHaveBeenCalledTimes(2);
  });
});
