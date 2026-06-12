# Spell-Spiff — Rune Recognition Harness

Goal: measure whether a webcam tells hand-drawn runes apart, fast and clean.

You draw runes in the air with one hand in front of a laptop webcam. MediaPipe
`@mediapipe/tasks-vision` HandLandmarker tracks the hand, a thumb–index pinch
acts as pen down/up, and a $1 Unistroke recognizer matches the stroke to a
trained rune. This harness exists to prove the recognition loop — speed and
accuracy across eight to ten runes — before any game logic is built.

## Run

```bash
npm install
npm run dev
```

Open the printed localhost URL and allow camera access.

## Stack

- Vite, vanilla JavaScript (no framework)
- `@mediapipe/tasks-vision` HandLandmarker (never the legacy `@mediapipe/hands`)
- Model file `public/hand_landmarker.task`, served locally
