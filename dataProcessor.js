// dataProcessor.js - Intelligent data handling for large datasets

function processDataForAI(data, question) {
  const dataLength = data.length;
  
  // If data is small, return all of it
  if (dataLength <= 100) {
    return {
      fullData: data,
      summary: generateDataSummary(data),
      sampleSize: dataLength
    };
  }
  
  // For large datasets, create intelligent sampling
  const sampleSize = Math.min(200, dataLength);
  let sampledData = [];
  
  // Stratified sampling - get representative data across the dataset
  const step = Math.floor(dataLength / sampleSize);
  for (let i = 0; i < dataLength; i += step) {
    if (sampledData.length < sampleSize) {
      sampledData.push(data[i]);
    }
  }
  
  // Always include recent data for trend analysis
  const recentData = data.slice(-20);
  sampledData = [...sampledData, ...recentData];
  
  // Remove duplicates
  sampledData = removeDuplicates(sampledData);
  
  // Generate summary statistics
  const summary = generateDataSummary(data);
  
  return {
    fullData: sampledData,
    summary: summary,
    sampleSize: sampledData.length,
    totalRecords: dataLength
  };
}

function generateDataSummary(data) {
  if (!data || data.length === 0) return {};
  
  const summary = {
    totalRecords: data.length,
    columns: Object.keys(data[0] || {}),
    dateColumns: [],
    numericColumns: [],
    categoricalColumns: []
  };
  
  // Analyze column types
  const firstRow = data[0];
  if (firstRow) {
    Object.keys(firstRow).forEach(key => {
      const sampleValues = data.slice(0, 10).map(row => row[key]);
      
      // Check if it's a date column
      if (isDateColumn(sampleValues)) {
        summary.dateColumns.push(key);
      }
      // Check if it's numeric
      else if (isNumericColumn(sampleValues)) {
        summary.numericColumns.push(key);
      }
      // Otherwise it's categorical
      else {
        summary.categoricalColumns.push(key);
      }
    });
  }
  
  // Add basic statistics for numeric columns
  summary.numericStats = {};
  summary.numericColumns.forEach(col => {
    const values = data.map(row => parseFloat(row[col])).filter(v => !isNaN(v));
    if (values.length > 0) {
      summary.numericStats[col] = {
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        count: values.length
      };
    }
  });
  
  return summary;
}

function isDateColumn(values) {
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // M/D/YY or M/D/YYYY
    /^\w+ \d{1,2},? \d{4}$/, // Month DD, YYYY
  ];
  
  return values.some(value => 
    datePatterns.some(pattern => pattern.test(value))
  );
}

function isNumericColumn(values) {
  return values.some(value => 
    !isNaN(parseFloat(value)) && value !== '' && value !== null
  );
}

function removeDuplicates(data) {
  const seen = new Set();
  return data.filter(item => {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function createOptimizedPrompt(data, question, summary) {
  let prompt = `You are an expert data analyst. Analyze the following data and answer the question.

Data Summary:
- Total Records: ${summary.totalRecords}
- Sample Size: ${summary.sampleSize}
- Columns: ${summary.columns.join(', ')}
- Numeric Columns: ${summary.numericColumns.join(', ')}
- Date Columns: ${summary.dateColumns.join(', ')}
- Categorical Columns: ${summary.categoricalColumns.join(', ')}

`;

  // Add numeric statistics if available
  if (Object.keys(summary.numericStats).length > 0) {
    prompt += `\nNumeric Statistics:\n`;
    Object.entries(summary.numericStats).forEach(([col, stats]) => {
      prompt += `- ${col}: min=${stats.min}, max=${stats.max}, avg=${stats.avg.toFixed(2)}\n`;
    });
  }

  prompt += `\nSample Data (${summary.sampleSize} records):\n${JSON.stringify(data.fullData, null, 2)}

Question: ${question}

Provide a comprehensive analysis. If the sample data is insufficient for the question, mention this limitation.

Respond in JSON format:
{
  "answer": "detailed analysis",
  "labels": [...],
  "data": [...],
  "type": "pie|bar|line",
  "confidence": "high|medium|low",
  "limitations": "any limitations of the analysis"
}`;

  return prompt;
}

module.exports = {
  processDataForAI,
  generateDataSummary,
  createOptimizedPrompt
};
