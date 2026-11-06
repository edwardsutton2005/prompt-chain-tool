# Morningside Takes Prompt Chain Tool

A separate superadmin-only Next.js application for editing and executing prompt chains stored in the shared Morningside Takes Supabase project.

## Features

- Create, rename, archive, and delete prompt chains.
- Create, configure, reorder, and delete sequential prompt steps.
- Select a Gemini model and generation settings per step.
- Render `{{input}}` and `{{previous_output}}` variables.
- Execute chains with text and optional JPEG, PNG, or WebP input.
- Persist intermediate step results, final output, errors, and generated media.
- Resolve `gif_search` output through the existing Giphy integration.
- Switch between light, dark, and system-default themes.

## Security model

Authorization is enforced independently at three layers:

1. `proxy.ts` requires a valid Supabase session.
2. Every protected page and route handler calls the server-side superadmin guard.
3. PostgreSQL RLS checks `profiles.is_superadmin` for every tool table and mutation.

The browser receives only the Supabase project URL and publishable key. Gemini and Giphy keys are server-only. This repository must never receive a Supabase service-role key.

## Local setup

1. Copy `.env.example` to `.env.local` and use the same Supabase URL and publishable key as the existing applications.
2. Add the server-only Gemini key/default model and the Giphy key used by `gif_search` chains.
3. Apply `hello_world/supabase/migrations/20261106160000_prompt_chain_tool_foundation.sql` to the shared project.
4. Add `http://localhost:3000/auth/callback` to the Supabase Auth redirect allowlist.
5. Install dependencies and start the app:

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck
npm run lint
npm test
npx next build --webpack
```

Webpack is used for the verification build because some restricted environments prevent Turbopack from binding its internal worker port.

## Vercel deployment

1. Import the `prompt-chain-tool` GitHub repository as its own Vercel project.
2. Configure all four variables from `.env.example` for Production, Preview, and Development.
3. Add the production `/auth/callback` URL to the Supabase Auth redirect allowlist.
4. Disable Vercel Deployment Protection for the production deployment.
5. Test signed-out, non-superadmin, and superadmin access from an Incognito window.
