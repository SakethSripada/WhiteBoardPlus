# WhiteboardPlus

WhiteboardPlus is a canvas app for making code tutorials and walkthroughs. You can draw on a whiteboard, add runnable Python code blocks, drop in tables and notes, and record a framed part of the canvas while you work.

## Stack

- React
- TypeScript
- Vite
- Tldraw
- CodeMirror
- Pyodide

## Run locally

1. Install dependencies

```bash
npm install
```

2. Start the dev server

```bash
npm run dev
```

3. Open the local URL shown by Vite

## Build

```bash
npm run build
```

## Project structure

- `src/App.tsx`: app composition
- `src/features/whiteboard/`: whiteboard feature code, hooks, custom shapes, and overlays
- `src/App.css`: app styling

## Notes

- Python runs in the browser through Pyodide.
- Recording prefers MP4 when the browser supports it and falls back to WebM otherwise.
