# Polaris Window: Space Apps demo film

Final film: `output/polaris-window-spaceapps-demo.mp4` (1920×1080, 30 fps, H.264 + AAC, yuv420p, 29.55 s). English subtitles: `output/polaris-window-en.srt`.

## Structure
- `src/PolarisFilm.tsx`: the six scenes, timed to the measured narration
- `src/config.ts`: captions, team names and challenge title (edit `TEAM_MEMBERS` to add teammates)
- `captures/`: real app UI screenshots (the three 3D frame sequences, about 250 MB, are not committed; re-capture them as described below)
- `assets/`: master voiceover and the original ambient bed

## Storyboard
| Time (s) | Narration | Picture |
|---|---|---|
| 0–4.4 | "…where. It's about when." | Sun on the real horizon at Connecting Ridge; WHERE? → WHEN? |
| 4.4–10.6 | sunlight → power, Earth → communication | Shadow time-lapse over Shackleton; SUNLIGHT → POWER, EARTH VIEW → COMMUNICATION |
| 10.6–12.6 | "Meet Polaris Window." | Mark and wordmark, challenge title, cut to the app |
| 12.6–21.6 | NASA data, explore, compare, landing windows | Orbit over the pole → Malapert metrics → comparison table → recommended landing window |
| 21.6–25.3 | "From complex scientific data…" | LOLA / SPICE / analysis; r = 0.990 and r = 0.992 vs NASA maps |
| 25.3–29.5 | "Polaris Window. Find your window to the moon." | Wordmark, tagline, URL, challenge and team |

## Render
```bash
npm install
npx remotion render src/index.ts PolarisFilm output/render-raw.mp4 --codec=h264 --audio-codec=aac --crf=18 --browser-executable=<path to chrome-headless-shell>
ffmpeg -i output/render-raw.mp4 -c:v libx264 -crf 18 -pix_fmt yuv420p -color_range tv -c:a aac -b:a 192k -movflags +faststart output/polaris-window-spaceapps-demo.mp4
```
To re-capture footage, serve `web/` locally and drive the app with Playwright (the 3D canvas is grabbed frame by frame while the app's own sun clock steps forward).
