# Release process: nothing goes live unreviewed

```
feature branch ──► Pull Request ──► ① CI: unit + backend + e2e tests (desktop & mobile)
                                    ② CodeRabbit AI review (must approve)
                                         │ ① and ② green
                                         ▼
                                   merge to main ──► deploy to https://jsonbondhu.irmaoshop.com
```

Production is built **only** from `main`, and `main` accepts changes **only** through a PR
that has passed both required gates: CI and CodeRabbit's approval. The owner chose this on
2026-09-27; manual preview QA and human review by the DevOps reviewer are optional.

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

### 3. Branch ruleset (makes the gates mandatory)
The rules live in the **`protect-main`** ruleset (Settings → Rules → Rulesets → protect-main),
targeting the default branch. Don't use Settings → Branches (classic protection); it is separate
and would not change the enforced rules. `protect-main` contains:
- [x] Require a pull request before merging → Require **1 approval** (CodeRabbit's approval counts) → Dismiss stale approvals on new commits
- [ ] Require review from Code Owners: **off** (no `CODEOWNERS` file; human review is optional)
- [x] Require status checks to pass: `unit-and-backend`, `e2e`, `CodeRabbit`
- [x] Require branches to be up to date before merging
- [x] Require conversation resolution before merging
- [x] Do not allow bypassing the above settings (this applies to admins too)
- [ ] Allow force pushes: **off**. Allow deletions: **off**

### 4. Hosting
- Production runs on the owner's server at https://jsonbondhu.irmaoshop.com (nginx serves `public/`;
  the ad API and admin portal run as a Node service; the admin portal is on
  https://cms-jsonbondhu.irmaoshop.com). Cloudflare Pages is no longer used, so there are no per-PR
  preview URLs: test locally (`npm test`, `npm run test:e2e`) and rely on CI.
- Only code merged to `main` may be deployed to the server.

## Everyday flow (Claude or any developer)
1. `git switch -c feat/<name>`, make changes, and add or update tests.
2. `npm test && npm run test:e2e` locally.
3. Push and open a PR. CI and CodeRabbit start automatically.
4. Fix every CodeRabbit and reviewer comment, then push again. Checks re-run.
5. When CodeRabbit approves and all checks are green, merge, then deploy `main` to the server.
   Anyone (e.g. the DevOps reviewer) can still review the PR and comment; it's optional.

## Rollback
Revert the bad change with a normal PR (`git revert`), merge it, and deploy `main` again.
For ad content mistakes, use the admin portal's version history (Rollback), and no deploy is needed.
