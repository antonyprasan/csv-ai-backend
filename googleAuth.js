// googleAuth.js
require('dotenv').config();
const { google } = require('googleapis');

function getAuthUrl() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://csv-ai-backend.onrender.com/auth/callback'
  );
  
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
        redirect_uri: 'https://csv-ai-backend.onrender.com/auth/callback'
  });
}

async function getTokens(code) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://csv-ai-backend.onrender.com/auth/callback'
  );
  
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

async function fetchSheetData(tokens, spreadsheetId, range) {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://csv-ai-backend.onrender.com/auth/callback'
  );
  
  oAuth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });
  return result.data.values;
}

module.exports = { getAuthUrl, getTokens, fetchSheetData };
