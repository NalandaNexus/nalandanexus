import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as dashboardService from '../services/dashboard.service.js';
import * as leaderboardService from '../services/leaderboard.service.js';
import * as realtimeService from '../services/realtime.service.js';

export const overview = catchAsync(async (req, res) => {
  const data = await dashboardService.getOverview();
  return sendSuccess(res, { data });
});

export const leaderboard = catchAsync(async (req, res) => {
  const data = await leaderboardService.computeLeaderboard();
  return sendSuccess(res, { data });
});

export const liveTelemetry = catchAsync(async (req, res) => {
  req.socket.setNoDelay(true);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const send = async () => {
    try {
      const snapshot = await realtimeService.getLiveSnapshot();
      res.write(`event: telemetry\ndata: ${JSON.stringify(snapshot)}\n\n`);
    } catch {
      // Skip a tick on transient DB hiccups rather than killing the stream.
    }
  };

  await send();
  const interval = setInterval(send, 5000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

export default { overview, leaderboard, liveTelemetry };
