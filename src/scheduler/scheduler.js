const cron = require('node-cron');
const Post = require('../models/Post');
const User = require('../models/User');
const Log = require('../models/Log');
const { createPost, refreshAccessToken } = require('../utils/linkedin');
const axios = require('axios');

const cronSpec = process.env.SCHEDULE_CRON || '*/1 * * * *'; // every minute by default
const timezone = process.env.SCHEDULER_TIMEZONE || 'Asia/Kolkata';

const MAX_ATTEMPTS = 3;
const EXPIRY_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

async function ensureValidToken(user) {
  // if token expires in < threshold, try refresh
  if (!user.tokenExpiresAt) return user; // no token info
  const now = Date.now();
  if (new Date(user.tokenExpiresAt).getTime() - now > EXPIRY_THRESHOLD_MS) return user; // still valid
  if (!user.refreshToken) throw new Error('No refresh token available for user');

  const refreshRes = await refreshAccessToken(user.refreshToken);
  const { access_token, expires_in, refresh_token } = refreshRes;
  user.accessToken = access_token;
  user.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
  if (refresh_token) user.refreshToken = refresh_token;
  await user.save();
  return user;
}

async function notifyFailure(user, post, err) {
  console.error(`[notify] user ${user._id} post ${post._id} failed:`, err?.message || err);
  const webhook = process.env.NOTIFICATION_WEBHOOK;
  if (webhook) {
    try {
      await axios.post(webhook, { userId: user._id, postId: post._id, error: err?.message || err });
    } catch (e) {
      console.error('[notify] webhook failed', e.message);
    }
  }
  // also store a log
  await Log.create({ user: user._id, post: post._id, level: 'error', message: String(err?.message || err), meta: { stack: err?.stack } });
}

cron.schedule(cronSpec, async () => {
  console.log('[scheduler] running check', new Date().toISOString());
  try {
    const now = new Date();
    // find due posts (pending and scheduleDate <= now) and attempts < MAX_ATTEMPTS
    const posts = await Post.find({ status: 'pending', scheduleDate: { $lte: now }, attempts: { $lt: MAX_ATTEMPTS } }).populate('user');
    if (!posts.length) return;

    for (const p of posts) {
      try {
        const user = await User.findById(p.user._id);
        if (!user) {
          p.status = 'failed';
          p.lastError = 'No associated user';
          await p.save();
          continue;
        }

        // ensure access token fresh (may refresh using refresh token)
        try {
          await ensureValidToken(user);
        } catch (err) {
          p.attempts += 1;
          p.lastError = 'Token refresh failed: ' + (err.message || err);
          await p.save();
          await notifyFailure(user, p, err);
          continue;
        }

        // call createPost helper
        const res = await createPost({
          accessToken: user.accessToken,
          authorUrn: user.authorUrn,
          commentary: p.content,
          media: p.media || []
        });

        p.status = 'posted';
        p.postedAt = new Date();
        await p.save();
        await Log.create({ user: user._id, post: p._id, level: 'info', message: 'Posted', meta: res });
        console.log('[scheduler] posted', p._id);
      } catch (err) {
        p.attempts += 1;
        p.lastError = err.response?.data || err.message || String(err);
        await p.save();
        await notifyFailure(p.user, p, err);
      }
    }
  } catch (err) {
    console.error('[scheduler] top-level error', err);
  }
}, { timezone });
