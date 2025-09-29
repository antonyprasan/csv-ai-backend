// googleAuth.js
require('dotenv').config();
const { google } = require('googleapis');

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

function getAuthUrl() {
  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
  });
}

async function getTokens(code) {
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

async function fetchSheetData(tokens, spreadsheetId, range) {
  oAuth2Client.setCredentials(tokens);
  const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range
  });
  return result.data.values;
}

module.exports = { getAuthUrl, getTokens, fetchSheetData };
