import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The Teacher portal renders the same module-video components, upload engine
 * and link parsers. If its copies drift, a teacher and an administrator would
 * see different rules for the same link or file. (The student service's own
 * copies of the parsers are checked by student/backend/tests.) Skipped when the
 * other portals are not alongside this one.
 */
const here = __dirname;
const norm = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('shared module-video code', () => {
  it('is identical in the Teacher portal', () => {
    const files = [
      'components/lessonVideos/LessonVideoEditor.jsx',
      'components/lessonVideos/LessonVideoManager.jsx',
      'components/lessonVideos/VideoPreview.jsx',
      'components/lessonVideos/VideoActivityPanel.jsx',
      'components/lessonVideos/YouTubeThumbnail.jsx',
      'components/lessonVideos/multipartUpload.js',
      'components/lessonVideos/multipartUpload.test.js',
      'components/lessonVideos/videoFormat.js',
      'utils/youtube.js',
      'utils/googleDrive.js',
    ];
    for (const file of files) {
      const mine = resolve(here, '../..', file);
      const theirs = resolve(here, '../../../../../teacher/frontend/src', file);
      if (!existsSync(theirs)) continue;
      expect(norm(theirs), `${file} differs between admin and teacher`).toBe(norm(mine));
    }
  });

  it('the student portal shows the same YouTube thumbnail and parses links the same way', () => {
    const pairs = [
      ['components/student/YouTubeThumbnail.jsx', 'components/lessonVideos/YouTubeThumbnail.jsx'],
      ['utils/youtube.js', 'utils/youtube.js'],
      ['utils/googleDrive.js', 'utils/googleDrive.js'],
    ];
    for (const [studentFile, adminFile] of pairs) {
      const student = resolve(here, '../../../../../student/frontend/src', studentFile);
      if (!existsSync(student)) continue;
      expect(norm(student), `${studentFile} differs from admin ${adminFile}`).toBe(norm(resolve(here, '../..', adminFile)));
    }
  });
});
