import { Student } from '../models/Student.js';
import { SchoolClass } from '../models/SchoolClass.js';
import { Concept } from '../models/Concept.js';
import { Assignment } from '../models/Assignment.js';
import { dicebearAvatar } from './student.service.js';

/**
 * Backend-side global search across students/classes/concepts/assignments,
 * each capped to a handful of results — replaces the previous approach of
 * shipping the entire 256-student dataset to the browser just to filter it
 * client-side in GlobalSearchModal.
 */
export async function globalSearch(teacherId, rawQuery) {
  const q = (rawQuery || '').trim();
  if (!q) return [];
  const regex = new RegExp(escapeRegex(q), 'i');

  const [students, classes, concepts, assignments] = await Promise.all([
    Student.find({ teacher: teacherId, status: 'active', linkedUserId: { $ne: null }, $or: [{ name: regex }, { email: regex }] })
      .populate('class', 'name')
      .limit(5)
      .lean(),
    SchoolClass.find({ teacher: teacherId, $or: [{ name: regex }, { subject: regex }] }).limit(3).lean(),
    Concept.find({ teacher: teacherId, $or: [{ name: regex }, { description: regex }] }).limit(3).lean(),
    Assignment.find({ teacher: teacherId, status: { $ne: 'archived' }, title: regex }).populate('class', 'name').limit(3).lean(),
  ]);

  const results = [];

  for (const s of students) {
    results.push({
      type: 'student',
      id: s._id,
      title: s.name,
      subtitle: `${s.class?.name || 'Unassigned'} • Score: ${s.metrics?.currentScore ?? 0}% • Risk: ${(s.metrics?.riskLevel || 'good').replace('_', ' ')}`,
      data: {
        id: s._id,
        name: s.name,
        email: s.email,
        avatar: s.avatarUrl || dicebearAvatar(s.name),
        classId: s.class?._id,
        className: s.class?.name,
        score: s.metrics?.currentScore ?? 0,
        riskLevel: s.metrics?.riskLevel ?? 'good',
      },
    });
  }

  for (const c of classes) {
    results.push({
      type: 'class',
      id: c._id,
      title: c.name,
      subtitle: `${c.subject}`,
      data: { id: c._id, name: c.name, subject: c.subject },
    });
  }

  for (const c of concepts) {
    results.push({
      type: 'concept',
      id: c._id,
      title: c.name,
      subtitle: c.description || c.subject || '',
      data: { id: c._id, key: c.key, name: c.name },
    });
  }

  for (const a of assignments) {
    results.push({
      type: 'assignment',
      id: a._id,
      title: a.title,
      subtitle: `${a.class?.name || ''} • Due: ${new Date(a.dueDate).toLocaleDateString()}`,
      data: { id: a._id, title: a.title, classId: a.class?._id },
    });
  }

  return results;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default { globalSearch };
