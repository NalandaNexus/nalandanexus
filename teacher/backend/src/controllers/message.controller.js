import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as messageService from '../services/message.service.js';

export const listConversations = catchAsync(async (req, res) => {
  const conversations = await messageService.listConversations(req.teacher._id);
  sendSuccess(res, { data: conversations });
});

export const startConversation = catchAsync(async (req, res) => {
  const conversation = await messageService.getOrCreateConversation(req.teacher._id, req.body.studentId);
  sendSuccess(res, { statusCode: 201, data: { id: conversation._id } });
});

export const getMessages = catchAsync(async (req, res) => {
  const messages = await messageService.getMessages(req.teacher._id, req.params.id);
  sendSuccess(res, { data: messages });
});

export const sendMessage = catchAsync(async (req, res) => {
  const message = await messageService.sendMessage(req.teacher._id, req.params.id, req.body.text, req.ip);
  sendSuccess(res, { statusCode: 201, message: 'Message sent.', data: message });
});

export const markConversationRead = catchAsync(async (req, res) => {
  const result = await messageService.markConversationRead(req.teacher._id, req.params.id);
  sendSuccess(res, { data: result });
});

export default { listConversations, startConversation, getMessages, sendMessage, markConversationRead };
