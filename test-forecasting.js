// Test script for forecasting functionality
const { isForecastingQuestion, generateSimpleForecast } = require('./dataProcessor');

console.log('🧪 Testing Forecasting Functionality\n');

// Test 1: Question detection
console.log('1. Testing Question Detection:');
const testQuestions = [
  'What will be my sales next month?',
  'Can you forecast my revenue for the next quarter?',
  'Show me sales trends',
  'Predict future sales',
  'What are my current sales?',
  'Analyze my data',
  'What is the trend in my sales?'
];

testQuestions.forEach(question => {
  const isForecast = isForecastingQuestion(question);
  console.log(`   "${question}" -> ${isForecast ? '✅ FORECAST' : '❌ ANALYSIS'}`);
});

// Test 2: Simple forecasting
console.log('\n2. Testing Simple Forecasting:');
const sampleData = [
  { month: 'Jan', sales: 100 },
  { month: 'Feb', sales: 120 },
  { month: 'Mar', sales: 110 },
  { month: 'Apr', sales: 130 },
  { month: 'May', sales: 140 },
  { month: 'Jun', sales: 150 },
  { month: 'Jul', sales: 160 },
  { month: 'Aug', sales: 170 }
];

const forecast = generateSimpleForecast(sampleData, 3);
if (forecast) {
  console.log(`   Trend: ${forecast.trend > 0 ? '📈 Growing' : '📉 Declining'} (${forecast.trend.toFixed(2)})`);
  console.log(`   Last Value: ${forecast.lastValue}`);
  console.log(`   Forecast (next 3 periods): [${forecast.forecast.join(', ')}]`);
  console.log(`   Confidence: ${forecast.confidence}`);
} else {
  console.log('   ❌ No forecast generated');
}

// Test 3: Array of numbers
console.log('\n3. Testing with Array of Numbers:');
const numericData = [100, 120, 110, 130, 140, 150, 160, 170, 180, 190];
const numericForecast = generateSimpleForecast(numericData, 4);
if (numericForecast) {
  console.log(`   Trend: ${numericForecast.trend > 0 ? '📈 Growing' : '📉 Declining'} (${numericForecast.trend.toFixed(2)})`);
  console.log(`   Last Value: ${numericForecast.lastValue}`);
  console.log(`   Forecast (next 4 periods): [${numericForecast.forecast.join(', ')}]`);
  console.log(`   Confidence: ${numericForecast.confidence}`);
} else {
  console.log('   ❌ No forecast generated');
}

console.log('\n✅ Forecasting tests completed!');
