/**
 * DEPRECATED entry point.
 *
 * The backend was rebuilt around a real MongoDB + Express + Razorpay stack
 * (see README.md). The actual server entry point is now `src/server.js`
 * (`npm run dev` / `npm start` already point there via package.json).
 * This file is kept only so a stray `node src/index.js` doesn't silently
 * run the old mock API - it redirects to the real server instead.
 */
import './server.js';
