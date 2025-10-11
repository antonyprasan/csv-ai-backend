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
  const sampleSize = Math.min(2000, dataLength); // Increased from 200
  let sampledData = [];
  
  // Time-based sampling for time series data
  if (hasDateColumn(data)) {
    sampledData = timeBasedSampling(data, sampleSize);
  } else {
    // Stratified sampling - get representative data across the dataset
    const step = Math.floor(dataLength / sampleSize);
    for (let i = 0; i < dataLength; i += step) {
      if (sampledData.length < sampleSize) {
        sampledData.push(data[i]);
      }
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

function hasDateColumn(data) {
  if (!data || data.length === 0) return false;
  const firstRow = data[0];
  return Object.keys(firstRow).some(key => {
    const sampleValues = data.slice(0, 10).map(row => row[key]);
    return isDateColumn(sampleValues);
  });
}

function timeBasedSampling(data, sampleSize) {
  // Sort by date if possible
  const sortedData = [...data].sort((a, b) => {
    const dateA = getDateValue(a);
    const dateB = getDateValue(b);
    return dateA - dateB;
  });
  
  // Sample evenly across time periods
  const step = Math.floor(sortedData.length / sampleSize);
  const sampled = [];
  
  for (let i = 0; i < sortedData.length; i += step) {
    if (sampled.length < sampleSize) {
      sampled.push(sortedData[i]);
    }
  }
  
  return sampled;
}

function getDateValue(row) {
  // Try to find a date column and return timestamp
  for (let key in row) {
    const value = row[key];
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.getTime();
      }
    }
  }
  return 0;
}

function createOptimizedPrompt(processedData, question, summary) {
  // Detect business type from data
  const businessType = detectBusinessType(processedData.fullData);
  const businessContext = getBusinessContext(businessType);
  
  let prompt = `You are a senior business analyst and consultant with expertise in ${businessType}. Your goal is to provide actionable business insights that drive growth and profitability.

BUSINESS CONTEXT:
- Business Type: ${businessType}
- Focus Areas: ${businessContext}
- Priority: Practical insights that business owners can implement immediately

DATA OVERVIEW:
- Total Records Analyzed: ${processedData.totalRecords || summary.totalRecords}
- Sample Size: ${processedData.sampleSize || summary.sampleSize}
- Key Metrics: ${summary.numericColumns.join(', ')}
- Time Period: ${getDateRange(processedData.fullData)}

BUSINESS INTELLIGENCE REQUEST: ${question}

ANALYSIS REQUIREMENTS:
1. Provide clear, actionable business insights (not just data analysis)
2. Include specific recommendations with potential impact
3. Focus on opportunities for growth and optimization
4. Use business language, not technical jargon
5. Highlight the most important findings first

`;

  // Add forecasting capability if question asks for predictions
  if (isForecastingQuestion(question)) {
    prompt += `FORECASTING CAPABILITY:
For forecasting questions, provide:
1. Trend analysis with business implications
2. Growth/decline projections with confidence levels
3. Strategic recommendations based on forecasts
4. Risk factors and contingency planning

`;
  }

  prompt += `Sample Data (${processedData.sampleSize || summary.sampleSize} records):\n${JSON.stringify(processedData.fullData, null, 2)}

IMPORTANT: This analysis is based on ${processedData.sampleSize || summary.sampleSize} records sampled from ${processedData.totalRecords || summary.totalRecords} total records, ensuring representative insights across your entire dataset.

REQUIRED OUTPUT FORMAT:
{
  "answer": "Clear business explanation with specific actionable recommendations",
  "keyInsights": ["Top 3 business insights from the data"],
  "recommendations": ["Specific actions to take based on findings"],
  "potentialImpact": "Expected business impact of implementing recommendations",
  "nextSteps": ["Immediate next steps to implement recommendations"],
  "labels": [...],
  "data": [...],
  "type": "pie|bar|line",
  "confidence": "high|medium|low",
  "limitations": "Any limitations of the analysis"
}

Focus on business value, growth opportunities, and actionable insights.`;

  return prompt;
}

// New helper functions for business context
function detectBusinessType(data) {
  if (!data || data.length === 0) return 'general business';
  
  const columns = Object.keys(data[0] || {});
  const lowerColumns = columns.map(c => c.toLowerCase());
  
  // Check for retail/e-commerce indicators
  if (lowerColumns.some(c => 
    c.includes('product') || c.includes('item') || c.includes('sku') || 
    c.includes('inventory') || c.includes('category')
  )) {
    return 'retail/e-commerce';
  }
  
  // Check for service business indicators
  if (lowerColumns.some(c => 
    c.includes('customer') || c.includes('client') || c.includes('service') ||
    c.includes('appointment') || c.includes('booking')
  )) {
    return 'service business';
  }
  
  // Check for sales/financial indicators
  if (lowerColumns.some(c => 
    c.includes('revenue') || c.includes('sales') || c.includes('profit') ||
    c.includes('commission') || c.includes('deal')
  )) {
    return 'sales/financial business';
  }
  
  // Check for restaurant/food service indicators
  if (lowerColumns.some(c => 
    c.includes('menu') || c.includes('dish') || c.includes('order') ||
    c.includes('table') || c.includes('check')
  )) {
    return 'restaurant/food service';
  }
  
  return 'general business';
}

function getBusinessContext(businessType) {
  const contexts = {
    'retail/e-commerce': 'product performance, inventory optimization, customer behavior, seasonal trends, revenue growth',
    'service business': 'customer retention, service efficiency, pricing optimization, client satisfaction, operational growth',
    'sales/financial business': 'revenue trends, sales forecasting, conversion rates, market opportunities, profit optimization',
    'restaurant/food service': 'menu optimization, customer preferences, operational efficiency, revenue per table, seasonal patterns',
    'general business': 'growth opportunities, operational efficiency, revenue optimization, market insights, strategic planning'
  };
  return contexts[businessType] || contexts['general business'];
}

function getDateRange(data) {
  if (!data || data.length === 0) return 'No date information';
  
  // Try to find date columns
  const firstRow = data[0];
  let dateColumn = null;
  
  for (let key in firstRow) {
    const sampleValues = data.slice(0, 5).map(row => row[key]);
    if (isDateColumn(sampleValues)) {
      dateColumn = key;
      break;
    }
  }
  
  if (dateColumn) {
    const dates = data.map(row => row[dateColumn]).filter(d => d);
    if (dates.length > 0) {
      const sortedDates = dates.sort();
      return `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`;
    }
  }
  
  return 'Time period not specified';
}

function isForecastingQuestion(question) {
  const forecastingKeywords = [
    'forecast', 'predict', 'future', 'next month', 'next quarter', 'next year',
    'trend', 'projection', 'will be', 'going to', 'expect', 'likely',
    'forecasting', 'prediction', 'upcoming', 'forthcoming'
  ];
  
  const lowerQuestion = question.toLowerCase();
  return forecastingKeywords.some(keyword => lowerQuestion.includes(keyword));
}

function generateSimpleForecast(data, periods = 3) {
  if (!data || data.length < 2) return null;
  
  // Extract numeric values from data
  const values = data.map(d => {
    if (typeof d === 'object' && d !== null) {
      // Find first numeric value in the object
      for (let key in d) {
        const val = parseFloat(d[key]);
        if (!isNaN(val)) return val;
      }
      return 0;
    }
    return typeof d === 'string' ? parseFloat(d) || 0 : (typeof d === 'number' ? d : 0);
  }).filter(v => !isNaN(v) && v > 0);
  
  if (values.length < 2) return null;
  
  // Calculate trend
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const trend = secondAvg - firstAvg;
  
  // Generate forecast
  const lastValue = values[values.length - 1];
  const forecast = Array.from({length: periods}, (_, i) => 
    Math.max(0, lastValue + (trend * (i + 1)))
  );
  
  // Calculate confidence based on data quality
  let confidence = 'low';
  if (values.length >= 6) confidence = 'medium';
  if (values.length >= 12 && Math.abs(trend) > 0) confidence = 'high';
  
  return {
    forecast: forecast,
    trend: trend,
    confidence: confidence,
    lastValue: lastValue,
    periods: periods
  };
}

module.exports = {
  processDataForAI,
  generateDataSummary,
  createOptimizedPrompt,
  isForecastingQuestion,
  generateSimpleForecast,
  detectBusinessType,
  getBusinessContext,
  getDateRange
};
