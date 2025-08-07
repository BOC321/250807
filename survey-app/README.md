# Survey Application

A comprehensive survey application with advanced scoring, consistency checking, and reporting capabilities.

## Features

- Flexible question types (single choice, multi-choice, scale, text)
- Advanced scoring model with weights and max scores
- Category and overall result calculation
- Rich reporting with PDF generation
- Email delivery of reports via Maileroo
- Admin interface for survey creation and management

## Technical Stack

- **Frontend**: Next.js (React)
- **Backend**: Supabase (PostgreSQL + Authentication)
- **Deployment**: Vercel
- **Email**: Maileroo API
- **PDF Generation**: pdfmake + html-to-pdfmake

## Database Schema

The database schema is defined in `survey_schema.sql` and includes:

- Surveys, categories, and questions
- Range sets for score classification
- Respondents and answers
- Results with computed scores
- Report assets for PDF generation

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   MAILEROO_API_KEY=your_maileroo_api_key
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment

Deploy to Vercel with the Supabase project connected.
