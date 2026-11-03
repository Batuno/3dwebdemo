# Free hosting setup — GitHub Pages

This project is a static Vite + React website with a Three.js showroom. It does not need a paid server for the current demo.

## Expected free URL
`https://ba7aa-ireedui.github.io/3d-bair-songolt/`

The exact URL will be shown by GitHub after the first successful deployment.

## Before deployment
1. Make sure the repository is **public** if using GitHub Pages on the free plan.
2. Review the Oak Ville @ AMK sample apartment data and brochure-derived reference files. Replace them or obtain permission before publishing the repository publicly or using the project commercially.
3. Keep the `.glb`, `.ktx2`, and `.hdr` files tracked with Git LFS. The deployment workflow checks out LFS files.
4. Do not upload `node_modules` or `.git` in a source ZIP. Dependencies are installed by `pnpm install`.

## First-time setup
1. Push the project to GitHub on branch `main`.
2. Open the repository → **Settings → Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as the source.
4. Open **Actions** and run **Deploy to GitHub Pages** once if it did not trigger automatically.
5. Wait for the workflow to finish. The Pages URL appears in the workflow's deployment environment and Settings → Pages.
6. Open the main site URL; the showroom is at the same URL plus `/showroom/`.

## Future updates
Push changes to `main`; the Pages workflow will build and deploy automatically. The project's automatic sync commits also trigger Actions after this change.

## What is included in the hosted site
- Landing website at `/`
- 3D interactive showroom at `/showroom/`
- Static project data and assets (no backend required for this demo)

## Limitations
- Lead forms are only demo/local browser behavior unless a backend endpoint is configured.
- GitHub Pages is static hosting; it cannot run a Node/Express server or store lead submissions centrally.
- For a private repository, use a host that supports private Git repositories, or publish a sanitized public demo repository.
- For production client projects, use your own authorized building data and assets.
