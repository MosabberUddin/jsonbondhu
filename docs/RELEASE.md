# Release process: nothing goes live unreviewed

```
feature branch ──► Pull Request ──► ① CI: unit + backend + e2e tests (desktop & mobile)
                                    ② CodeRabbit AI review (must approve)
                                    ③ Cloudflare Pages preview URL (manual QA)
                                    ④ DevOps reviewer approval
                                         │ all green
                                         ▼
                                   merge to main ──► Cloudflare Pages deploys production
```

Production is built **only** from `main`, and `main` accepts changes **only** through a PR
that has passed all four gates.

## One-time setup (the owner does these; each takes about 5 minutes)

### 1. GitHub repository
1. Create a GitHub account and a new repository `jsonbondhu`. Private is fine.
2. Push this folder:
   ```bash
   git remote add origin https://github.com/<you>/jsonbondhu.git
   git push -u origin main
   ```
3. Invite the DevOps reviewer: Settings → Collaborators → add them with the **Maintain** role.

### 2. CodeRabbit
1. Go to https://coderabbit.ai → Sign in with GitHub → install the app **only on the `jsonbondhu` repo**.
2. The review rules are already in `.coderabbit.yaml`: an assertive profile, security-focused
   instructions per folder, gitleaks secret scanning, and the actionlint, markdownlint, biome and htmlhint linters.
3. Pricing: CodeRabbit is free for public repos. A private repo needs a paid seat. Check
   current pricing on their site before choosing private.
4. Ask CodeRabbit questions or request a re-review by commenting `@coderabbitai review` on a PR.

### 3. Branch protection (makes the gates mandatory)
Settings → Branches → Add rule for `main`:
- [x] Require a pull request before merging → Require **1 approval** → Dismiss stale approvals on new commits
- [x] Require review from Code Owners (the `CODEOWNERS` file names @biprajit007)
- [x] Require status checks to pass: `unit-and-backend`, `e2e`, `CodeRabbit`
- [x] Require branches to be up to date before merging
- [x] Require conversation resolution before merging
- [x] Do not allow bypassing the above settings (this applies to admins too)
- [ ] Allow force pushes: **off**. Allow deletions: **off**

### 4. Cloudflare Pages
- Production branch: `main`. Preview deployments: **all non-production branches**.
  Every PR gets its own URL (`<branch>.jsonbondhu.pages.dev`) for testing before merge.
- Protect preview URLs and `/admin` with Cloudflare Access (see `docs/ADS.md`).

## Everyday flow (Claude or any developer)
1. `git switch -c feat/<name>`, make changes, and add or update tests.
2. `npm test && npm run test:e2e` locally.
3. Push and open a PR. CI and CodeRabbit start automatically.
4. Fix every CodeRabbit and reviewer comment, then push again. Checks re-run.
5. The DevOps reviewer tests the preview URL and approves. Then merge, and it's live within about 1 minute.

## Rollback
Cloudflare dashboard → Pages → jsonbondhu → Deployments → pick the last good one → **Rollback**.
This is instant. Then fix forward with a normal PR.
For ad content mistakes, use the admin portal's version history (Rollback), and no deploy is needed.
