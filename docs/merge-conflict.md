# Resolving PR Merge Conflicts with `main`

If GitHub shows **Merge conflicts** on your PR, run these commands locally from your feature branch:

```bash
git fetch origin
git checkout <your-feature-branch>
git merge origin/main
```

If files conflict:

1. Open conflicted files and keep the correct final code.
2. Remove conflict markers:
   - `<<<<<<< HEAD`
   - `=======`
   - `>>>>>>> origin/main`
3. Stage and complete merge:

```bash
git add .
git commit -m "Resolve merge conflicts with main"
git push origin <your-feature-branch>
```

## Recommended for this project

After resolving conflicts and before pushing:

```bash
npm install
npx eslint src/routes/auth.tsx src/routes/index.tsx src/lib/storage.ts src/server.ts
npm run build
```

Then refresh the PR page; GitHub should no longer show merge conflicts.
