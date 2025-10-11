const { detectBusinessType, getBusinessContext, getDateRange, createOptimizedPrompt } = require('./dataProcessor');

console.log('🧪 Testing Business-Focused Prompts\n');

// Test business type detection
console.log('1. Testing Business Type Detection:');
const retailData = [
  { product: 'Laptop', sales: 100, category: 'Electronics', inventory: 50 },
  { product: 'Mouse', sales: 200, category: 'Accessories', inventory: 100 }
];

const serviceData = [
  { customer: 'John Doe', service: 'Consulting', appointment: '2024-01-15', client_satisfaction: 5 },
  { customer: 'Jane Smith', service: 'Training', appointment: '2024-01-16', client_satisfaction: 4 }
];

const salesData = [
  { revenue: 50000, sales_rep: 'Alice', deal_size: 25000, commission: 2500 },
  { revenue: 75000, sales_rep: 'Bob', deal_size: 35000, commission: 3500 }
];

console.log(`  Retail data: ${detectBusinessType(retailData)}`);
console.log(`  Service data: ${detectBusinessType(serviceData)}`);
console.log(`  Sales data: ${detectBusinessType(salesData)}`);
console.log('\n');

// Test business context
console.log('2. Testing Business Context:');
console.log(`  Retail context: ${getBusinessContext('retail/e-commerce')}`);
console.log(`  Service context: ${getBusinessContext('service business')}`);
console.log(`  Sales context: ${getBusinessContext('sales/financial business')}`);
console.log('\n');

// Test date range detection
console.log('3. Testing Date Range Detection:');
const timeSeriesData = [
  { date: '2024-01-01', sales: 100 },
  { date: '2024-02-01', sales: 150 },
  { date: '2024-03-01', sales: 200 }
];

console.log(`  Time series data: ${getDateRange(timeSeriesData)}`);
console.log(`  No date data: ${getDateRange(retailData)}`);
console.log('\n');

// Test complete prompt generation
console.log('4. Testing Complete Prompt Generation:');
const mockProcessedData = {
  fullData: retailData,
  sampleSize: 2,
  totalRecords: 100
};

const mockSummary = {
  columns: ['product', 'sales', 'category', 'inventory'],
  numericColumns: ['sales', 'inventory'],
  categoricalColumns: ['product', 'category']
};

const prompt = createOptimizedPrompt(mockProcessedData, 'What are my best selling products?', mockSummary);
console.log('  Generated prompt length:', prompt.length);
console.log('  Contains business context:', prompt.includes('retail/e-commerce'));
console.log('  Contains business focus:', prompt.includes('product performance'));
console.log('  Contains actionable insights:', prompt.includes('keyInsights'));
console.log('  Contains recommendations:', prompt.includes('recommendations'));

console.log('\n✅ Business prompt tests completed!');
