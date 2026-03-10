# CaresLink - AI Recruitment Agent

Full-stack AI recruitment agent powered by Google Gemini, with real Twilio SMS, SendGrid email, and data-driven insights.

## Features

- **AI Agent** — Anthropic Claude with tool use for natural language recruitment tasks
- **Real APIs** — Twilio (SMS), SendGrid (Email)
- **Dashboard** — Metrics, candidates, interviews, insights
- **Data-driven insights** — Recommendations for no-show rate, channel effectiveness, cost optimization

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Initialize database**
   ```bash
   npm run db:push
   npm run db:seed
   ```

4. **Run dev server**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## API Keys

| Service | Where to get |
|---------|--------------|
| Anthropic Claude | [Console](https://console.anthropic.com/) |
| Twilio | [Twilio Console](https://www.twilio.com/console) |
| SendGrid | [SendGrid](https://app.sendgrid.com/) |

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   ├── candidates/    # Candidates page
│   ├── interviews/    # Interviews page
│   └── insights/      # Insights page
├── components/
├── lib/
│   ├── db.ts
│   ├── gemini.ts      # AI agent
│   ├── twilio.ts
│   ├── sendgrid.ts
│   ├── scheduling.ts
│   └── insights.ts
```

## License

MIT
