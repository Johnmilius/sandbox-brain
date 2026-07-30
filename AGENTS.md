<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Branching

Branch off `dev`, and open pull requests against `dev`. `main` is release-only — it is
updated by merging `dev` into it, so do not target `main` directly.

```bash
git checkout dev && git pull && git checkout -b <type>/<slug>
gh pr create --base dev
```

If a branch was cut from `main` by mistake, rebase it onto `dev` before retargeting the
PR. `main` carries the dev→main merge commit that `dev` does not, so changing the base
alone pulls that back-merge into the PR as an extra commit.
