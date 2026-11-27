import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import CourseStructureManager from './CourseStructureManager';

function course() {
  return {
    slug: 'prarambh',
    title: 'PRARAMBH',
    updatedAt: '2026-11-01T00:00:00.000Z',
    progressionGatingEnabled: true,
    modules: [
      {
        moduleId: 'mod-1',
        title: 'Awakening',
        order: 1,
        description: 'Getting started',
        gatingEnabled: null,
        lessonCount: 2,
        updatedAt: '2026-11-01T00:00:00.000Z',
        updatedBy: { portal: 'admin', name: 'Super' },
        lessons: [
          {
            lessonId: 'l-1',
            title: 'Welcome',
            order: 1,
            duration: '10 min',
            summary: '',
            content: '',
            isPublished: true,
            isLocked: false,
            hasVideo: false,
            updatedAt: '2026-11-01T00:00:00.000Z',
            updatedBy: null,
          },
          {
            lessonId: 'l-2',
            title: 'Archetypes',
            order: 2,
            duration: '',
            summary: '',
            content: '',
            isPublished: false,
            isLocked: false,
            hasVideo: true,
            updatedAt: null,
            updatedBy: null,
          },
        ],
      },
      {
        moduleId: 'mod-2',
        title: 'Foundations',
        order: 2,
        description: '',
        gatingEnabled: null,
        lessonCount: 1,
        updatedAt: null,
        updatedBy: null,
        lessons: [
          {
            lessonId: 'l-3',
            title: 'Numbers',
            order: 1,
            duration: '',
            summary: '',
            content: '',
            isPublished: true,
            isLocked: true,
            hasVideo: false,
            updatedAt: null,
            updatedBy: null,
          },
        ],
      },
    ],
  };
}

function makeApi(overrides = {}) {
  return {
    listCourses: vi.fn().mockResolvedValue([
      { slug: 'prarambh', title: 'PRARAMBH', isPublished: true },
      { slug: 'garud', title: 'GARUD', isPublished: true },
    ]),
    getStructure: vi.fn().mockImplementation(async (slug) => (slug === 'prarambh' ? course() : { ...course(), slug, title: slug, modules: [] })),
    addModule: vi.fn(),
    updateModule: vi.fn(),
    reorderModules: vi.fn(),
    addLesson: vi.fn(),
    updateLesson: vi.fn(),
    reorderLessons: vi.fn(),
    removeLesson: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe('CourseStructureManager', () => {
  it('lists modules and lessons with their badges', async () => {
    const api = makeApi();
    render(<CourseStructureManager api={api} heading="Course Content" description="" emptyMessage="none" />);
    expect(await screen.findByText('Awakening')).toBeInTheDocument();
    expect(screen.getByText('Foundations')).toBeInTheDocument();
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.getByText('Numbers')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
  });

  it('adding a module calls addModule and shows the fresh structure it returns', async () => {
    const withNewModule = {
      ...course(),
      modules: [
        ...course().modules,
        {
          moduleId: 'mod-3',
          title: 'New Module',
          order: 3,
          description: '',
          gatingEnabled: null,
          lessonCount: 0,
          updatedAt: '2026-11-20T00:00:00.000Z',
          updatedBy: null,
          lessons: [],
        },
      ],
    };
    const api = makeApi({ addModule: vi.fn().mockResolvedValue(withNewModule) });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    await screen.findByText('Awakening');

    fireEvent.click(screen.getByRole('button', { name: 'Add a module' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Module' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add module' }));

    await waitFor(() => expect(api.addModule).toHaveBeenCalledWith('prarambh', expect.objectContaining({ title: 'New Module' })));
    expect(await screen.findByText('New Module')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Module added.');
  });

  it('editing a module forwards the version it loaded and shows a notice', async () => {
    const api = makeApi({ updateModule: vi.fn().mockResolvedValue(course()) });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    // Scoped to the module's own header (not the whole <section>, which also
    // contains every one of its lessons' "Edit" buttons).
    const header = (await screen.findByText('Awakening')).closest('div');

    fireEvent.click(within(header).getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Awakening Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.updateModule).toHaveBeenCalledWith(
        'prarambh',
        'mod-1',
        expect.objectContaining({ title: 'Awakening Renamed', expectedUpdatedAt: '2026-11-01T00:00:00.000Z' })
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent('"Awakening" saved.');
  });

  it('moving a module up swaps its order and calls reorderModules with the flipped ids', async () => {
    const api = makeApi({ reorderModules: vi.fn().mockResolvedValue({ ...course(), modules: [...course().modules].reverse() }) });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    await screen.findByText('Foundations');

    fireEvent.click(screen.getByRole('button', { name: 'Move Foundations up' }));

    await waitFor(() => expect(api.reorderModules).toHaveBeenCalledWith('prarambh', ['mod-2', 'mod-1']));
  });

  it('a module\'s up arrow is disabled when it is already first', async () => {
    const api = makeApi();
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    await screen.findByText('Awakening');
    expect(screen.getByRole('button', { name: 'Move Awakening up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Foundations down' })).toBeDisabled();
  });

  it('adding a lesson to a module calls addLesson with that module\'s id', async () => {
    const api = makeApi({ addLesson: vi.fn().mockResolvedValue(course()) });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    await screen.findByText('Awakening');

    fireEvent.click(screen.getByRole('button', { name: 'Add a lesson to "Awakening"' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Lesson' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }));

    await waitFor(() => expect(api.addLesson).toHaveBeenCalledWith('prarambh', 'mod-1', expect.objectContaining({ title: 'New Lesson' })));
  });

  it('editing a lesson can unpublish it, forwarding its own version', async () => {
    const api = makeApi({ updateLesson: vi.fn().mockResolvedValue(course()) });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    const row = (await screen.findByText('Welcome')).closest('li');

    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(row).getByRole('checkbox'));
    fireEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.updateLesson).toHaveBeenCalledWith(
        'prarambh',
        'mod-1',
        'l-1',
        expect.objectContaining({ isPublished: false, expectedUpdatedAt: '2026-11-01T00:00:00.000Z' })
      )
    );
  });

  it('removing a lesson with no progress removes it from the list', async () => {
    const api = makeApi({ removeLesson: vi.fn().mockResolvedValue({ removed: true }) });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    const row = (await screen.findByText('Numbers')).closest('li');

    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(row).getByRole('button', { name: /Remove lesson/ }));
    fireEvent.click(within(row).getByRole('button', { name: 'Yes, remove' }));

    await waitFor(() => expect(api.removeLesson).toHaveBeenCalledWith('prarambh', 'mod-2', 'l-3', expect.objectContaining({ expectedUpdatedAt: null })));
    await waitFor(() => expect(screen.queryByText('Numbers')).not.toBeInTheDocument());
    expect(await screen.findByRole('status')).toHaveTextContent('"Numbers" removed.');
  });

  it('a student with real progress blocks the removal and explains why, without removing it', async () => {
    const api = makeApi({
      removeLesson: vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { status: 409, code: 'LESSON_HAS_PROGRESS', errors: { progressCount: 3 } })),
    });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    const row = (await screen.findByText('Welcome')).closest('li');

    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    fireEvent.click(within(row).getByRole('button', { name: /Remove lesson/ }));
    fireEvent.click(within(row).getByRole('button', { name: 'Yes, remove' }));

    expect(await within(row).findByRole('alert')).toHaveTextContent(/3 students have already opened or completed this lesson/);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });

  it('a version conflict on a module patches just that module, leaving the rest of the page alone', async () => {
    const current = {
      moduleId: 'mod-1',
      title: 'Theirs Now',
      order: 1,
      description: 'changed elsewhere',
      gatingEnabled: null,
      lessonCount: 2,
      updatedAt: '2026-11-10T00:00:00.000Z',
      updatedBy: { portal: 'teacher', name: 'Alice Rao' },
      lessons: course().modules[0].lessons,
    };
    const api = makeApi({
      updateModule: vi.fn().mockRejectedValue(Object.assign(new Error('This module was changed by Alice Rao since you opened it.'), { status: 409, errors: { current } })),
    });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    const header = (await screen.findByText('Awakening')).closest('div');

    fireEvent.click(within(header).getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My Edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Load the current version' }));

    expect(await screen.findByText('Theirs Now')).toBeInTheDocument();
    // The other module, never touched by this conflict, is still exactly as it was.
    expect(screen.getByText('Foundations')).toBeInTheDocument();
  });

  it('switching course loads that course', async () => {
    const api = makeApi();
    render(<CourseStructureManager api={api} heading="Course Content" description="" emptyMessage="none" />);
    await screen.findByText('Awakening');
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'garud' } });
    await waitFor(() => expect(api.getStructure).toHaveBeenCalledWith('garud'));
    expect(await screen.findByText(/has no modules yet/)).toBeInTheDocument();
  });

  it('shows the empty message when no course is available', async () => {
    render(<CourseStructureManager api={makeApi({ listCourses: vi.fn().mockResolvedValue([]) })} heading="H" description="" emptyMessage="No courses assigned" />);
    expect(await screen.findByText('No courses assigned')).toBeInTheDocument();
  });

  it('shows a load failure instead of an empty page', async () => {
    const api = makeApi({ listCourses: vi.fn().mockRejectedValue(new Error('The Student service is unavailable')) });
    render(<CourseStructureManager api={api} heading="H" description="" emptyMessage="none" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The Student service is unavailable');
  });
});

/**
 * The Teacher portal renders the same components (same shape as the
 * lesson-video components' own check). If its copies drift, a teacher and an
 * administrator would see different rules for the same course structure.
 * Trivially passes until the Teacher portal has its own copies.
 */
describe('shared course-content components', () => {
  it('are identical in the Teacher portal', () => {
    for (const file of ['CourseStructureManager.jsx', 'ModuleEditor.jsx', 'LessonEditor.jsx']) {
      const mine = resolve(__dirname, file);
      const theirs = resolve(__dirname, '../../../../../teacher/frontend/src/components/courseContent', file);
      if (!existsSync(theirs)) continue;
      const norm = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
      expect(norm(theirs), `${file} differs between admin and teacher`).toBe(norm(mine));
    }
  });
});
