# Deployment Guide

## Branch Structure

```
master (development)
  ↓ manually merge to
staging (staging environment)
  ↓ manually merge to
production (production environment)
```

- **`master`** — Main development branch. Push features here via PRs or directly. GitHub Actions runs tests on every push.
- **`staging`** — Staging environment. Deployed to Vercel staging for testing before production.
- **`production`** — Production environment. Deployed to Vercel production.

## Promoting Code

### master → staging

When you're ready to test on staging:

```bash
git checkout staging
git pull origin staging
git merge origin/master
git push origin staging
```

Or if you prefer rebasing:

```bash
git checkout staging
git pull origin staging
git rebase origin/master
git push --force-with-lease origin staging
```

Vercel will auto-deploy the `staging` branch to the staging environment.

### staging → production

When staging is validated and ready for production:

```bash
git checkout production
git pull origin production
git merge origin/staging
git push origin production
```

Vercel will auto-deploy the `production` branch to the production environment.

## Workflow Example

1. Create a feature branch and push to GitHub
   ```bash
   git checkout -b feature/my-feature
   git push -u origin feature/my-feature
   ```

2. Open a PR to `master`, review, and merge

3. When ready for staging, merge master → staging:
   ```bash
   git checkout staging
   git pull origin staging
   git merge origin/master
   git push origin staging
   ```

4. Test on staging environment

5. When validated, merge staging → production:
   ```bash
   git checkout production
   git pull origin production
   git merge origin/staging
   git push origin production
   ```

## Environment Variables

Each Vercel environment (staging & production) must have these variables configured:

- `DATABASE_URL` — Supabase connection string
- `GEMINI_API_KEY` — Gemini API key for receipt extraction

Configure these separately in Vercel for each environment.
