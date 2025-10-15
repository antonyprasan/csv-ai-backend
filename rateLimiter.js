// Simple in-memory rate limiter
// In production, use Redis or database

const requestCounts = new Map();

/**
 * Reset all counters at midnight
 */
function resetCounters() {
  requestCounts.clear();
  console.log('✅ Rate limit counters reset');
}

// Reset daily at midnight
setInterval(resetCounters, 24 * 60 * 60 * 1000);

/**
 * Check if IP has exceeded rate limit
 */
function checkRateLimit(ip, maxRequests = 10) {
  const today = new Date().toDateString();
  const key = `${ip}-${today}`;
  
  const currentCount = requestCounts.get(key) || 0;
  
  if (currentCount >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      total: maxRequests,
      resetTime: getNextMidnight(),
    };
  }
  
  return {
    allowed: true,
    remaining: maxRequests - currentCount - 1,
    total: maxRequests,
    resetTime: getNextMidnight(),
  };
}

/**
 * Increment request count for IP
 */
function incrementCount(ip) {
  const today = new Date().toDateString();
  const key = `${ip}-${today}`;
  const currentCount = requestCounts.get(key) || 0;
  requestCounts.set(key, currentCount + 1);
}

/**
 * Get next midnight timestamp
 */
function getNextMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Get remaining requests for IP
 */
function getRemainingRequests(ip, maxRequests = 10) {
  const today = new Date().toDateString();
  const key = `${ip}-${today}`;
  const currentCount = requestCounts.get(key) || 0;
  return maxRequests - currentCount;
}

/**
 * Express middleware for rate limiting
 */
function rateLimitMiddleware(maxRequests = 10) {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const limitCheck = checkRateLimit(ip, maxRequests);
    
    // Add rate limit info to response headers
    res.set({
      'X-RateLimit-Limit': limitCheck.total,
      'X-RateLimit-Remaining': limitCheck.remaining,
      'X-RateLimit-Reset': limitCheck.resetTime,
    });
    
    if (!limitCheck.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `You've reached your daily limit of ${maxRequests} requests. Please try again tomorrow.`,
        remaining: 0,
        resetTime: limitCheck.resetTime,
      });
    }
    
    incrementCount(ip);
    next();
  };
}

module.exports = {
  checkRateLimit,
  incrementCount,
  getRemainingRequests,
  rateLimitMiddleware,
  resetCounters,
  requestCounts,
};

