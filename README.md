# Vibe Booth

A pocket EDM festival on a volcanic island in the Marianas. DJ two decks, make beats in the Studio, and run the lasers, lava vents, and sail screen with Shigost on the decks.

## Project layout

```
index.html          page markup
styles.css          all styling
app.js              the whole app: music engine, 3D island, game, UI
assets/shigost.glb  Shigost's rigged model with sit, dance, and jump clips
assets/shigost.jpg  Shigost's texture
```

Three.js r128, its GLTFLoader, Tone.js 14.8.49, and the Google Fonts load from public CDNs, so there is no build step and nothing to install.

## Run it in VS Code

1. Open this folder in VS Code (File, then Open Folder).
2. Install the recommended **Live Server** extension when VS Code suggests it.
3. Right-click `index.html` and choose **Open with Live Server**.

It has to run through a server (Live Server, or `npx serve` in a terminal) because the browser blocks loading the 3D model from a double-clicked file.

## Publish it

**Netlify Drop (fastest):** go to app.netlify.com/drop and drag this whole folder onto the page. You get a public link in seconds and can add a custom domain later.

**GitHub Pages:** push the folder to a GitHub repo, then in the repo go to Settings, Pages, and choose "Deploy from a branch" with the `main` branch and `/ (root)`.

Either host serves it over HTTPS, which the audio engine needs.

## Notes

- Progress, saved tracks, and settings live in each player's browser (localStorage).
- Shigost, the Kikis, and the crowd characters are original characters. © Recklyss Studios. All rights reserved.

## Credits

- [three.js](https://threejs.org) (MIT License)
- [Tone.js](https://tonejs.github.io) (MIT License)
- Fonts: Fraunces and DM Sans via Google Fonts (SIL Open Font License)
