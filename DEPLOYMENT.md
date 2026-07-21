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

### Option A: GitHub Actions (Recommended)

Use automated workflows to create promotion PRs with built-in reviews.

#### master → staging

1. Go to GitHub repo → **Actions** tab
2. Select **"Promote to Staging"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. GitHub Actions creates a PR from master → staging
5. Review the PR and merge to deploy to staging

#### staging → production

1. Go to **Actions** tab
2. Select **"Promote to Production"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. GitHub Actions creates a PR from staging → production
5. **Review carefully** (requires approval before merging)
6. Merge to deploy to production

### Option B: Manual (Git Commands)

If you prefer command line:

#### master → staging

```bash
git checkout staging
git pull origin staging
git merge origin/master
git push origin staging
```

#### staging → production

```bash
git checkout production
git pull origin production
git merge origin/staging
git push origin production
```

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

## CI/CD Pipeline

### Pre-Merge Checks

GitHub Actions runs automatically on all branches:

- **Type checking** — TypeScript compilation
- **Debt Simplification tests** — Settlement algorithm
- **Item Allocation tests** — Receipt item assignment
- **Linting** — Code quality (if configured)

**Merges are blocked if tests fail.** Fix the issues and push again.

### Vercel Auto-Deploy

When a PR is merged:

1. Vercel detects the push to the branch
2. Runs the build process
3. Deploys to the corresponding environment:
   - `staging` branch → Staging environment
   - `production` branch → Production environment

Deployment typically takes 1-3 minutes. Check Vercel dashboard to monitor progress.

## Environment Variables

Each Vercel environment (staging & production) must have these variables configured:

- `DATABASE_URL` — Supabase connection string
- `GEMINI_API_KEY` — Gemini API key for receipt extraction

Configure these separately in Vercel for each environment.

## Recommended Branch Protection Rules

To enforce this workflow in GitHub:

1. Go to repo **Settings** → **Branches**
2. Add branch protection for `staging` and `production`:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass (CI tests)
   - ✅ Require branches to be up to date before merging
   - ✅ Dismiss stale PR approvals when new commits are pushed

This ensures all deployments go through review and passing tests.
