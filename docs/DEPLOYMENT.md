# Deployment

PackMap is a static local-first application. The public Beta is deployed from `main` to GitHub Pages by `.github/workflows/deploy-pages.yml`.

## Production path

- Repository: `https://github.com/Emillly1/packmap-travel-packing`
- Site: `https://emillly1.github.io/packmap-travel-packing/`
- Feedback: GitHub Issues using the Beta feedback form
- Persistence: browser local storage only; deployment does not receive trip data

The workflow installs locked dependencies, runs type checks and unit tests, builds with the repository subpath, checks the performance budget, and uploads an immutable Pages artifact.

## First deployment

1. Create the public repository and push `main`.
2. In **Settings > Pages**, choose **GitHub Actions** as the source if it is not selected automatically.
3. Wait for both `CI` and `Deploy PackMap` to finish.
4. Open the site in a private window and complete the template-to-export smoke flow.
5. Verify the editorial image, feedback link, refresh behavior, mobile layout, and print preview.

For a local production-path smoke test, build with `VITE_BASE_PATH=/packmap-travel-packing/`, serve `dist`, then run `PACKMAP_URL=http://127.0.0.1:4174/packmap-travel-packing/ npm run test:browser` against a Chrome debugging session.

## Rollback

Git history is the rollback source of truth. Revert the faulty release commit on `main` and push; the Pages workflow will deploy the previous state as a new immutable artifact. For an urgent stop, disable Pages or the deploy workflow in repository settings while preserving the repository and issue history.

Local user data is schema-versioned and remains in each browser. A deployment rollback must not downgrade the supported schema without a tested migration path.
