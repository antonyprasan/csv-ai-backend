# 🚀 Groq Setup Instructions

## Get Your FREE Groq API Key

1. **Go to Groq Console:** https://console.groq.com
2. **Sign up** (free account)
3. **Go to API Keys:** https://console.groq.com/keys
4. **Click "Create API Key"**
5. **Copy the key** (starts with `gsk_...`)

## Add to Your .env File

Open `.env` and add:

```bash
# Add this line
GROQ_API_KEY=gsk_your_actual_key_here

# Change this to use Groq (free) instead of OpenAI (paid)
AI_PROVIDER=groq

# Optional: Set rate limits
MAX_REQUESTS_PER_IP_PER_DAY=10
ENABLE_RATE_LIMIT=true
```

## Test It Works

```bash
# Start your backend
npm start

# Should see: "Server running on port 3000"
```

## Free Tier Limits

- ✅ **14,400 requests per day** (FREE!)
- ✅ **30 requests per minute**
- ✅ No credit card required
- ✅ Models: Llama 3.1 70B, Mixtral, Gemma

## Switch Between Providers

**Use Groq (Free):**
```bash
AI_PROVIDER=groq
```

**Use OpenAI (Paid):**
```bash
AI_PROVIDER=openai
```

Just change the environment variable - no code changes needed!

## Cost Comparison

| Provider | Cost/Request | Free Tier |
|----------|-------------|-----------|
| Groq | ~$0.0001 | 14,400/day FREE |
| OpenAI GPT-4 | ~$0.03 | None |
| **Savings** | **300x cheaper!** | ✅ |

## Need Help?

- Groq Docs: https://console.groq.com/docs
- LangChain Groq: https://python.langchain.com/docs/integrations/chat/groq

