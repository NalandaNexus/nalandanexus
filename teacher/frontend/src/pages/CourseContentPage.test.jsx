import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';

const listeners = {};

const api = {
  getLessonVideoCourses: vi.fn(),
  getCourseStructure: vi.fn(),
  addCourseModule: vi.fn(),
  updateCourseModule: vi.fn(),
  reorderCourseModules: vi.fn(),
  addCourseLesson: vi.fn(),
  updateCourseLesson: vi.fn(),
  reorderCourseLessons: vi.fn(),
  removeCourseLesson: vi.fn(),
};

vi.mock('../services/teacherApiService', () => ({ teacherApiService: api }));
vi.mock('../services/socketService', () => ({
  socketService: {
    connect: vi.fn(),
    on: vi.fn((event, fn) => {
      listeners[event] = fn;
      return () => delete listeners[event];
    }),
  },
}));

const { default: CourseContentPage } = await import('./CourseContentPage');

function garud() {
  return {
    slug: 'garud',
    title: 'GARUD',
    updatedAt: '2026-11-01T00:00:00.000Z',
    progressionGatingEnabled: true,
    modules: [
      {
        moduleId: 'g-mod-1',
        title: 'Flight',
        order: 1,
        description: '',
        gatingEnabled: null,
        lessonCount: 1,
        updatedAt: '2026-11-01T00:00:00.000Z',
        updatedBy: null,
        lessons: [
          {
            lessonId: 'g-1',
            title: 'Lift-off',
            order: 1,
            duration: '',
            summary: '',
            content: '',
            isPublished: true,
            isLocked: false,
            hasVideo: false,
            updatedAt: '2026-11-01T00:00:00.000Z',
            updatedBy: null,
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.getLessonVideoCourses.mockResolvedValue([{ slug: 'garud', title: 'GARUD', isPublished: true }]);
  api.getCourseStructure.mockResolvedValue(garud());
});
afterEach(cleanup);

describe('Teacher Course Content page', () => {
  it('shows only the courses the backend says are assigned', async () => {
    render(<CourseContentPage />);
    expect(await screen.findByText('Lift-off')).toBeInTheDocument();
    const options = within(screen.getByLabelText('Course')).getAllByRole('option').map((o) => o.value);
    expect(options).toEqual(['garud']);
  });

  it('adds a module through the teacher API', async () => {
    const withNew = { ...garud(), modules: [...garud().modules, { moduleId: 'g-mod-2', title: 'Orbit', order: 2, description: '', gatingEnabled: null, lessonCount: 0, updatedAt: '2026-11-20T00:00:00.000Z', updatedBy: null, lessons: [] }] };
    api.addCourseModule.mockResolvedValue(withNew);
    render(<CourseContentPage />);
    await screen.findByText('Flight');
    fireEvent.click(screen.getByRole('button', { name: 'Add a module' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Orbit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add module' }));
    await waitFor(() => expect(api.addCourseModule).toHaveBeenCalledWith('garud', expect.objectContaining({ title: 'Orbit' })));
    expect(await screen.findByText('Orbit')).toBeInTheDocument();
  });

  it('explains when nothing is assigned', async () => {
    api.getLessonVideoCourses.mockResolvedValue([]);
    render(<CourseContentPage />);
    expect(await screen.findByText(/No courses have been assigned to you yet/)).toBeInTheDocument();
    expect(api.getCourseStructure).not.toHaveBeenCalled();
  });

  it('reloads when an administrator changes this teacher’s assignments', async () => {
    render(<CourseContentPage />);
    await screen.findByText('Flight');
    api.getLessonVideoCourses.mockResolvedValue([]);
    await act(async () => {
      listeners['course.access_changed']({ added: [], removed: ['garud'] });
    });
    expect(await screen.findByText(/No courses have been assigned to you yet/)).toBeInTheDocument();
  });

  it('surfaces a refusal from the backend', async () => {
    api.updateCourseModule.mockRejectedValue(Object.assign(new Error('This course has not been assigned to you.'), { status: 403, code: 'COURSE_NOT_ASSIGNED' }));
    render(<CourseContentPage />);
    const header = (await screen.findByText('Flight')).closest('div');
    fireEvent.click(within(header).getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not been assigned to you/);
  });
});
