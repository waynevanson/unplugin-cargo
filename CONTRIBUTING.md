# Contributing

## Releasing

Releases are cut only in CI, through `.github/workflows/release.yml`, which builds the package, runs `pnpm pack`, and attaches the tarball to a GitHub Release. Bump the root `package.json` and push a matching tag (with or without a `v` prefix) — the workflow refuses to release when the tag and the package version disagree:

```bash
git tag 0.2.1 && git push origin 0.2.1
```

You can also release an untagged commit by running the `release` workflow manually from the Actions tab (`workflow_dispatch`) and picking a branch, tag, or commit SHA; in that case the tag is created from the package version. The tag check only applies when HEAD is tagged, so bump the version before re-dispatching.

Re-running a release re-uploads the tarball for that tag with `--clobber`, so published versions are effectively immutable — bump the version rather than replacing a release's assets.
