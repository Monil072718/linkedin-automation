const express = require('express');
const jwt = require('jsonwebtoken');
const { exchangeCodeForToken, fetchProfile } = require('../utils/linkedin');
const User = require('../models/User');
const router = express.Router();

const { LINKEDIN_CLIENT_ID, LINKEDIN_REDIRECT_URI, JWT_SECRET } = process.env;

// Step 1: Redirect to LinkedIn for consent
router.get('/linkedin', (req, res) => {
  const state = Math.random().toString(36).slice(2);
  const scope = encodeURIComponent('r_liteprofile r_emailaddress w_member_social');
  const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_REDIRECT_URI)}&state=${state}&scope=${scope}`;
  res.redirect(url);
});

// Step 2: Callback - exchange code, save tokens, create user & return JWT
router.get('/linkedin/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');

  try {
    const tokenData = await exchangeCodeForToken(code);
    const { access_token, expires_in, refresh_token, scope } = tokenData;

    // fetch profile
    const profile = await fetchProfile(access_token);
    const linkedinId = profile.id;
    const firstName = (profile.firstName?.localized && Object.values(profile.firstName.localized)[0]) || '';
    const lastName = (profile.lastName?.localized && Object.values(profile.lastName.localized)[0]) || '';

    const authorUrn = `urn:li:person:${linkedinId}`;

    // upsert user
    const tokenExpiresAt = new Date(Date.now() + (expires_in * 1000));
    let user = await User.findOne({ linkedinId });
    if (!user) {
      user = new User({
        linkedinId,
        firstName,
        lastName,
        authorUrn,
        accessToken: access_token,
        refreshToken: refresh_token || null,
        tokenExpiresAt,
        scopes: scope || ''
      });
    } else {
      user.accessToken = access_token;
      user.refreshToken = refresh_token || user.refreshToken;
      user.tokenExpiresAt = tokenExpiresAt;
      user.scopes = scope || user.scopes;
      user.authorUrn = authorUrn;
      user.firstName = firstName;
      user.lastName = lastName;
    }
    await user.save();

    // issue JWT for API usage
    const jwtToken = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    // Return a tiny HTML page with the token (so you can copy it client-side); you can replace with redirect to front-end
    res.send(`
      <html><body>
        <h3>Auth successful ✅</h3>
        <p>Copy the token and store it in your client to call the API:</p>
        <textarea style="width:100%;height:120px">${jwtToken}</textarea>
        <p>You can close this tab.</p>
      </body></html>
    `);
  } catch (err) {
    console.error('Auth callback error', err.response?.data || err.message);
    res.status(500).send('Authentication failed. Check server logs.');
  }
});

module.exports = router;
