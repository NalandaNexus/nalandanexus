import { User } from '../models/User.js';
import { Teacher } from '../models/Teacher.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './audit.service.js';

export async function getProfile(teacherId) {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) throw ApiError.notFound('Teacher profile not found.', 'TEACHER_NOT_FOUND');
  const user = await User.findById(teacher.user);
  return teacher.toSafeJSON(user);
}

const USER_FIELDS = ['name', 'phone'];
const TEACHER_FIELDS = ['title', 'department', 'subject', 'qualification', 'experienceYears', 'bio'];

export async function updateProfile(teacherId, updates, ip) {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) throw ApiError.notFound('Teacher profile not found.', 'TEACHER_NOT_FOUND');
  const user = await User.findById(teacher.user);
  if (!user) throw ApiError.notFound('Account not found.', 'ACCOUNT_NOT_FOUND');

  const changed = {};
  for (const field of USER_FIELDS) {
    if (updates[field] !== undefined && updates[field] !== user[field]) {
      changed[field] = { from: user[field], to: updates[field] };
      user[field] = updates[field];
    }
  }
  for (const field of TEACHER_FIELDS) {
    if (updates[field] !== undefined && updates[field] !== teacher[field]) {
      changed[field] = { from: teacher[field], to: updates[field] };
      teacher[field] = updates[field];
    }
  }

  await user.save();
  await teacher.save();

  if (Object.keys(changed).length) {
    await logAudit({ actorId: teacherId, action: 'profile.updated', targetType: 'Teacher', targetId: teacherId, metadata: { changed }, ip });
  }

  return teacher.toSafeJSON(user);
}

export async function updatePreferences(teacherId, preferences) {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) throw ApiError.notFound('Teacher profile not found.', 'TEACHER_NOT_FOUND');

  teacher.preferences = { ...teacher.preferences.toObject(), ...preferences };
  await teacher.save();
  const user = await User.findById(teacher.user);
  return teacher.toSafeJSON(user);
}

export async function updateAvatar(teacherId, avatarUrl) {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) throw ApiError.notFound('Teacher profile not found.', 'TEACHER_NOT_FOUND');
  const user = await User.findByIdAndUpdate(teacher.user, { avatarUrl }, { new: true });
  return teacher.toSafeJSON(user);
}

export default { getProfile, updateProfile, updatePreferences, updateAvatar };
