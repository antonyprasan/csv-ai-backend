require('dotenv').config();


const express = require('express');
const multer = require('multer');
const cors = require('cors');
const csv = require('csv-parser');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
const upload = multer({ dest: 'uploads/' });
const port = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

app.post('/api/ask', upload.single('csv'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const question = req.body.question;
    console.log(question)

    const data = await parseCSV(filePath);
    const jsonSample = JSON.stringify(data.slice(0, 20)); // send first 5 rows

    const prompt = `
You are an assistant analyzing CSV data. Answer the question based on this sample data:
${jsonSample}

Question: ${question}

Respond in the following JSON format:

{
  "answer": "short answer",
  "labels": [...],
  "data": [...],
  "type": "pie"
}
        `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0].message.content;
    console.log(raw)

    let result;
    try {
      result = JSON.parse(raw);
      console.log(result)
    } catch (e) {
      result = { answer: raw, chart: null };
    }

    res.json(result);
    fs.unlink(filePath, () => {}); // clean up temp file
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});