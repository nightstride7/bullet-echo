# Contributing

Thanks for helping. This is an early alpha, so small focused PRs win.

1. Fork, then `npm install && npm run dev`.
2. Branch from `main`: `feat/…` or `fix/…`.
3. Keep the app **local-first**: no required backend, no tracking, no keys in the repo.
4. **Never commit real contacts or pipeline data.** Use fictional data in `src/data/sample.js`.
5. Open a PR describing the problem, the change, and a screenshot for UI changes.

## Secret scanning

Every push and PR is scanned by [gitleaks](https://github.com/gitleaks/gitleaks) in CI, using the rules in `.gitleaks.toml` (gitleaks' default secret rules plus checks for real LinkedIn profile URLs and private session links). Maintainers can keep extra private rules in a local, git-ignored `.gitleaks.local.toml` that extends the public config; the pre-commit hook uses it automatically when it exists. CI only uses the public `.gitleaks.toml`.

To catch problems before they leave your machine, install gitleaks locally:

- macOS: `brew install gitleaks`
- Anything else: download a binary from the [gitleaks Releases page](https://github.com/gitleaks/gitleaks/releases) and put it on your `PATH`.

The pre-commit hook in `.githooks/` activates automatically when you run `npm install` (the `prepare` script sets `core.hooksPath`). It scans your staged changes and blocks the commit if it finds anything. If gitleaks isn't installed, the hook prints a notice and lets the commit through, but CI will still check it.

Ideas welcome via [issues](../../issues): "keep or kill" feedback is the most useful contribution right now.

By contributing you agree your work is released under the MIT License.
