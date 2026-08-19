# Kadel Labs - MCQ Assessment Platform

A secure MCQ assessment platform with advanced anti-cheating measures for training programs and certifications.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Database-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC)

## Features

### Admin Features
- 📝 Create assessments with custom names and time limits
- 📊 Upload questions via Excel files
- 📈 View detailed results and violation logs
- 🔗 Generate shareable exam links
- ✅ Toggle assessment active/inactive status

### Trainee Features
- 👤 Simple registration before exam
- ⏱️ Timed assessments with auto-submit
- 📱 Clean, responsive exam interface
- 📊 Instant score display after submission

### Anti-Cheating Measures
- 🎥 Camera monitoring (face detection)
- 🎤 Microphone monitoring for audio alerts
- 🖥️ Fullscreen enforcement
- 🚫 Tab switch detection
- 🔒 Copy/paste prevention
- ⚠️ Violation logging and thresholds

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### 1. Clone and Install

```bash
cd kadel-labs-mcq
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor and run the contents of `supabase-schema.sql`
3. Go to Project Settings > API and copy your keys

### 3. Configure Environment Variables

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Create Admin User

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add User" and create an admin account
3. Use these credentials to log into the admin panel

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Excel Question Format

Upload questions in Excel (.xlsx) with these columns:

| Question | Option A | Option B | Option C | Option D | Correct Answer |
|----------|----------|----------|----------|----------|----------------|
| What is 2+2? | 3 | 4 | 5 | 6 | B |
| Capital of France? | London | Paris | Berlin | Madrid | B |

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## Project Structure

```
kadel-labs-mcq/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── admin/              # Admin dashboard & management
│   │   ├── exam/               # Trainee exam pages
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   └── ui/                 # Reusable UI components
│   ├── hooks/
│   │   ├── useProctoring.ts    # Anti-cheat monitoring
│   │   └── useTimer.ts         # Exam timer
│   ├── lib/
│   │   ├── supabase/           # Supabase clients
│   │   ├── excel-parser.ts     # Excel file parsing
│   │   └── utils.ts            # Utility functions
│   └── types/
│       └── index.ts            # TypeScript types
├── supabase-schema.sql         # Database schema
└── .env.local.example          # Environment template
```

## Security Considerations

- Row Level Security (RLS) enabled on all tables
- Admin routes protected by middleware
- Correct answers only fetched server-side during grading
- Violations logged for review

## License

MIT License - feel free to use for your own projects!

---

Built with ❤️ by Kadel Labs
