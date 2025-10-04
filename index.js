require("dotenv").config();

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const csv = require("csv-parser");
const fs = require("fs");
const { OpenAI } = require("openai");

const { google } = require("googleapis");
const { getAuthUrl, getTokens, fetchSheetData } = require('./googleAuth');
const { processDataForAI, createOptimizedPrompt, isForecastingQuestion, generateSimpleForecast } = require('./dataProcessor');
const app = express();
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 3000;

// Store temporary tokens (in production, use a proper database)
const tempTokens = new Map();

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
    console.log("🚀 ~ processedData:", processedData)
    const prompt = createOptimizedPrompt(processedData, question, processedData.summary);
    console.log("🚀 ~ prompt:", prompt)

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });
    console.log("🚀 ~ completion:", completion)

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
      'https://csv-ai-backend.onrender.com/auth/callback'
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
    console.log("🚀 ~ processedData:", processedData)
    const prompt = createOptimizedPrompt(processedData, question, processedData.summary);
    console.log("🚀 ~ prompt:", prompt)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });
    console.log("🚀 ~ completion:", completion)

    const raw = completion.choices[0].message.content;
    console.log("🚀 ~ raw:", raw)
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
    
    // Store the token temporarily
    const sessionId = Math.random().toString(36).substring(2, 15);
    tempTokens.set(sessionId, tokens);
    
    // Return a professional OAuth success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful - DataViz AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            padding: 50px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
            width: 90%;
          }
          .logo {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 20px;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .success {
            font-size: 24px;
            margin-bottom: 15px;
            color: #4CAF50;
          }
          .message {
            font-size: 16px;
            opacity: 0.9;
            line-height: 1.5;
            margin-bottom: 30px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .status {
            font-size: 14px;
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">📊 DataViz AI</div>
          <div class="success">✅ Authentication Successful!</div>
          <div class="message">
            You have successfully connected your Google account.<br>
            You can now close this window and return to your mobile app.
          </div>
          <div class="spinner"></div>
          <div class="status">Returning to DataViz AI...</div>
        </div>
        <script>
          // Try to redirect to mobile app immediately
          setTimeout(() => {
            try {
              // Try to redirect to the mobile app using the current Expo tunnel URL
              window.location.href = 'exp://zrfjqd0-anonymous-8081.exp.direct/--/auth/callback?token=' + encodeURIComponent('${tokens.access_token}');
            } catch (e) {
              console.log('Deep link failed, trying to close window');
              // Fallback: try to close the window
              window.close();
            }
          }, 1000);
          
          // Backup: try to close after 3 seconds if redirect fails
          setTimeout(() => {
            try {
              window.close();
            } catch (e) {
              console.log('Cannot close window, user needs to close manually');
            }
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Get the latest token (simple approach)
app.get('/auth/latest-token', (req, res) => {
  try {
    // Get the most recent token from tempTokens
    const latestToken = Array.from(tempTokens.values()).pop();
    if (!latestToken) {
      return res.status(404).json({ error: 'No token available' });
    }

    res.json({ 
      success: true, 
      accessToken: latestToken.access_token,
      refreshToken: latestToken.refresh_token 
    });
  } catch (error) {
    console.error('Get token error:', error);
    res.status(500).json({ error: 'Failed to retrieve token' });
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
      'https://csv-ai-backend.onrender.com/auth/callback'
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