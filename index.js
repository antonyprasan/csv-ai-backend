require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const csv = require("csv-parser");
const fs = require("fs");
const { OpenAI } = require("openai");

const { google } = require("googleapis");
const { getAuthUrl, getTokens, fetchSheetData } = require('./googleAuth');
const { processDataForAI, createOptimizedPrompt } = require('./dataProcessor');
const app = express();
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (err) => reject(err));
  });
}

app.post("/api/ask", upload.single("csv"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const question = req.body.question;
    console.log(question);

    const data = await parseCSV(filePath);
    
    // Process data intelligently for AI analysis
    const processedData = processDataForAI(data, question);
    const prompt = createOptimizedPrompt(processedData, question, processedData.summary);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0].message.content;
    console.log(raw);

    let result;
    try {
      result = JSON.parse(raw);
      console.log(result);
      
      // Add metadata about data processing
      result.metadata = {
        totalRecords: processedData.totalRecords,
        sampleSize: processedData.sampleSize,
        confidence: result.confidence || 'medium',
        limitations: result.limitations || null
      };
    } catch (e) {
      result = { 
        answer: raw, 
        chart: null,
        metadata: {
          totalRecords: processedData.totalRecords,
          sampleSize: processedData.sampleSize,
          confidence: 'low',
          limitations: 'Failed to parse AI response'
        }
      };
    }

    res.json(result);
    fs.unlink(filePath, () => {}); // clean up temp file
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post('/api/ask-sheets', async (req, res) => {
  try {
    const { spreadsheetId, range, question, accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Access token required. Please authenticate first.',
        authUrl: getAuthUrl()
      });
    }

    // Use OAuth2 with the provided access token
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range, // e.g. 'Sheet1!A1:D1000'
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data found in spreadsheet' });
    }

    // Convert to array of objects
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || '');
      return obj;
    });

    // Process data intelligently for AI analysis
    const processedData = processDataForAI(data, question);
    const prompt = createOptimizedPrompt(processedData, question, processedData.summary);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(raw);
      
      // Add metadata about data processing
      result.metadata = {
        totalRecords: processedData.totalRecords,
        sampleSize: processedData.sampleSize,
        confidence: result.confidence || 'medium',
        limitations: result.limitations || null
      };
    } catch (e) {
      result = { 
        answer: raw, 
        chart: null,
        metadata: {
          totalRecords: processedData.totalRecords,
          sampleSize: processedData.sampleSize,
          confidence: 'low',
          limitations: 'Failed to parse AI response'
        }
      };
    }

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Add authentication endpoints
app.get('/auth/google', (req, res) => {
  const authUrl = getAuthUrl();
  res.json({ authUrl });
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const tokens = await getTokens(code);
    
    // Redirect back to test page with token in URL
    const redirectUrl = `/test.html?token=${tokens.access_token}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// List Google Sheets endpoint
app.post('/api/list-sheets', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Access token required. Please authenticate first.',
        authUrl: getAuthUrl()
      });
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    // Get files from Google Drive that are Google Sheets
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });

    const sheetsList = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime
    }));

    res.json({
      success: true,
      sheets: sheetsList
    });

  } catch (err) {
    console.error('Error listing sheets:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Google Sheets: ' + err.message
    });
  }
});

// List Google Sheets endpoint
app.post('/api/list-sheets', async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Access token required. Please authenticate first.',
        authUrl: getAuthUrl()
      });
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://csv-ai-backend.onrender.com/auth/callback'
    );
    
    oAuth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: oAuth2Client });

    // List Google Sheets files
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50
    });

    const sheets = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      modifiedTime: file.modifiedTime
    }));

    res.json({ 
      success: true, 
      sheets: sheets,
      message: `Found ${sheets.length} Google Sheets`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Google Sheets', details: err.message });
  }
});

// Test endpoint to verify Google Sheets connection
app.post('/api/test-sheets', async (req, res) => {
  try {
    const { spreadsheetId, range, accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Access token required. Please authenticate first.',
        authUrl: getAuthUrl()
      });
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oAuth2Client.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: 'v4', auth: oAuth2Client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: range || 'A1:D10',
    });

    const rows = response.data.values || [];
    res.json({ 
      success: true, 
      data: rows,
      message: `Successfully connected to Google Sheets. Found ${rows.length} rows.`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to connect to Google Sheets', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
