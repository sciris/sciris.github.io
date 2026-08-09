# sciris.github.io

Source for the [Sciris](https://sciris.org) website. This is the project landing page; the documentation lives separately at [docs.sciris.org](https://docs.sciris.org) (built from the `docs` folder of the [Sciris repository](https://github.com/sciris/sciris)).

## Structure

- `index.md` – all of the site content, written in Markdown with Nunjucks shortcodes
- `base.njk` – the page template (navbar, hero, footer)
- `eleventy.config.js` – build configuration, plus the shortcodes used by `index.md` (`section`, `cards`, `examples`, `topbuttons`, etc.)
- `assets/` – CSS, JS, images; `assets/img/make-examples.py` regenerates the example plot

## Building

Requires [Node.js](https://nodejs.org). To build into `_site`:

```bash
./build.sh
```

To preview at <http://localhost:8080>, rebuilding as you edit:

```bash
./serve.sh
```

`./clean.sh` removes `_site` and `node_modules`.

## Deployment

Pushing to `master` builds and deploys the site to GitHub Pages via `.github/workflows/deploy.yml`. Note that this requires GitHub Pages to be set to "GitHub Actions" as its source in the repository settings.
