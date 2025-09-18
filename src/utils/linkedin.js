const axios = require('axios');
const qs = require('querystring');

const {
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI,
  LINKEDIN_VERSION
} = process.env;

const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const ME_URL = 'https://api.linkedin.com/v2/me';
const POSTS_URL = 'https://api.linkedin.com/rest/posts';

// Exchange authorization code for access token (+ refresh token if granted)
async function exchangeCodeForToken(code) {
  const payload = qs.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: LINKEDIN_REDIRECT_URI,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET
  });

  const res = await axios.post(TOKEN_URL, payload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return res.data; // { access_token, expires_in, refresh_token? }
}

// Refresh access token using refresh token (if your app has this capability)
async function refreshAccessToken(refreshToken) {
  const payload = qs.stringify({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: LINKEDIN_CLIENT_ID,
    client_secret: LINKEDIN_CLIENT_SECRET
  });

  const res = await axios.post(TOKEN_URL, payload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  return res.data; // { access_token, expires_in, refresh_token? }
}

// Get LinkedIn member profile (basic)
async function fetchProfile(accessToken) {
  const res = await axios.get(ME_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0'
    }
  });
  return res.data;
}

// Create a basic text post on behalf of authorUrn (authorUrn = 'urn:li:person:{id}')
async function createPost({ accessToken, authorUrn, commentary, media = [] }) {
  const payload = {
    author: authorUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED' },
    ...(media.length ? { content: { media } } : {})
  };

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': LINKEDIN_VERSION,
    'Content-Type': 'application/json'
  };

  const res = await axios.post(POSTS_URL, payload, { headers });
  return res.data;
}

module.exports = {
  exchangeCodeForToken,
  refreshAccessToken,
  fetchProfile,
  createPost
};
