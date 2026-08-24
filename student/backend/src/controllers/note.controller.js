import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { AppError } from '../utils/AppError.js';
import { Note } from '../models/Note.js';

export const listNotes = asyncHandler(async (req, res) => {
  const notes = await Note.find({ userId: req.user._id }).sort({ createdAt: -1 });
  return sendSuccess(res, { data: notes });
});

export const createNote = asyncHandler(async (req, res) => {
  const note = await Note.create({ userId: req.user._id, ...req.body });
  return sendSuccess(res, { status: 201, message: 'Note saved.', data: note });
});

export const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, req.body, { new: true });
  if (!note) throw AppError.notFound('Note not found', 'NOTE_NOT_FOUND');
  return sendSuccess(res, { message: 'Note updated.', data: note });
});

export const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!note) throw AppError.notFound('Note not found', 'NOTE_NOT_FOUND');
  return sendSuccess(res, { message: 'Note deleted.' });
});
