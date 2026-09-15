# Pakistan Citizen Helper V2

Version 2 redesign of Pakistan Citizen Helper.

## V2 highlights
- Mobile-first, high-contrast interface with restrained Pakistan green accents.
- Clear 3-step flow: Choose department -> Choose service -> Ask question.
- Selecting a service automatically moves to and focuses the question area.
- Persistent browser profile: Name, Province/Region, Preferred Language.
- Province is used only for services that need provincial/local jurisdiction; federal services are not restricted by profile province.
- Live verification attempt against approved official `.gov.pk` URLs already stored in verified Supabase records.
- Verified Supabase information remains the fallback when a live official page cannot be retrieved.
- Result badges distinguish live official verification from verified-record fallback.
- AI prompt strictly limits answers to verified records and retrieved official source content.

## Environment variables
Keep the existing Vercel variables:
- GROQ_API_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY

Do not put secret values in source code.

## Deployment
This is a standard Next.js 14 project.

Build:
`npm run build`

Start:
`npm run start`

The V2 API remains at `/api/ask`.

## Important
The live-source layer only follows HTTPS URLs on `.gov.pk` domains. It does not perform unrestricted web searching.
