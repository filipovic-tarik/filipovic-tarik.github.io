# Tarik Filipovic — Personal Website

This repository hosts the source files for Tarik Filipovic's personal portfolio website.

The site includes Tarik's portrait and a dedicated nine-piece graphite gallery at
`art.html`. Browser-ready,
optimized images live in `assets/gallery`; the locally stored source photographs in
`assets/Images` are intentionally excluded from deployment.

The selected-work section also features the independent paper *Earth's Trajectory
Through the Universe*. Its dedicated visualization lives at `trajectory.html`, with
a browser-readable copy of the original paper stored in `assets/projects`.

**Live site:** [https://filipovic-tarik.github.io](https://filipovic-tarik.github.io)

## Local development

Clone the repository and run a simple local server from its directory:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser. For a basic static site, you can also open `index.html` directly.

## Deployment

The site is intended to be deployed with GitHub Pages. Once Pages is configured for the publishing branch, pushed changes will be published automatically.
