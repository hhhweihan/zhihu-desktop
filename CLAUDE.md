# Repository Guidance

## Packaging

- Do not run local build or packaging commands by default.
- Prefer pushing to GitHub to trigger Actions for Windows package generation.
- Use local build or electron-builder only when the user explicitly requests local verification.

## Versioning

- This product is not at v1.0.0 yet.
- Keep the root package version below 1.0.0 until productization is explicitly declared complete.
- Do not create or suggest a v1.0.0 tag unless the user explicitly asks for the formal product release.
- Use 0.x versions for current cloud builds and release candidates.

## Release Flow

- Push to master to trigger CI Build and generate the packaged artifact in GitHub Actions.
- Create a matching tag only when a formal release is needed.
- The tag must match package.json version on the same commit, for example package.json 0.9.0 requires tag v0.9.0.
- If the goal is only to get a package from CI, a master push is enough; a tag is not required.