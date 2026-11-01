# Cable Ctrl

**Design and print fold-over cable flag labels for the Liene PixCut S1, in your browser.**

**Open it: <https://woodwerd.github.io/cable-ctrl/>** · [User guide](https://woodwerd.github.io/cable-ctrl/guide.html)

## What it does

- **Fits your cable.** Set the tab size to your thickest cable, and see the exact cut drawing.
- **Tells you what can print.** Every design gets a verdict, and if it can't print, the app names the fix.
- **Colours by type.** All your USB cables gold, all your Ethernet blue. Change a type and its labels follow.
- **Numbered runs.** Make ETH-01 to ETH-24 in one step, with a tab for each end of the cable.
- **Excel and CSV import.** Fill in the template, then see what will be added before anything changes.
- **Print-ready sheets.** PNGs at the Liene's 90 × 170 mm print area, with the exact settings to enter in the Liene app.
- **Private.** No network requests, no analytics, no account. Your list stays on your device.
- Light and dark themes. Installs as a web app and works offline.

## Run it yourself

Serve the `site/` folder with any static web server:

```bash
python3 -m http.server 8138 --directory site
```

Then open <http://localhost:8138>.

## Repository layout

| Path | What |
|---|---|
| `site/` | The whole app. This folder is what GitHub Pages publishes. |
| `site/core.js` | The rules, with no page code. |
| `site/app.js` | The page. Plain JavaScript, with no build step. |
| `test/` | Tests for `core.js`, named by spec acceptance ID: `npm test`. |
| `tools/` | Sources for the shared page parts and the Excel template. Run `python3 tools/assemble.py` after changing them. |

## Credits and licence

© 2026 WOODWERD LLC, [MIT licence](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the fonts it distributes.

Cable Ctrl is an independent project. It is not affiliated with or endorsed by Liene. Liene and PixCut are trademarks of their owners.
