# Spell-Spiff

## PROJECT

A two-player webcam game. You cast spells by drawing runes in the air with one
hand, read by a regular camera, no VR. Each rune maps to a spell. Two players
duel in real time.

## BASIS

Inspired by War of Wizards, a VR game where you draw sigils to cast. We keep
the rune-drawing input. We drop the VR-only parts: 3D body dodging, 3D aiming,
room scale, and the full MOBA with minions and lanes.

## INPUT MODEL

One hand, MediaPipe tasks-vision HandLandmarker. Pinch of thumb and index is
pen down. Draw a shape, release, and a $1 Unistroke recognizer matches it to a
spell. Drawing size and cleanliness scale spell power later.

## COMBAT MODEL

Real-time telegraphed duel. Drawing a rune takes time, and the drawing motion
is a visible tell the opponent reads and counters. Not turn-based. Not rock
paper scissors.

## ANTI-SPAM

Stronger spells need longer, more complex runes, which means a longer
vulnerable window. Complexity is the cost. No separate charge action.

## DEFENSE

No body dodge. Defense is a cast. Draw a shield or counter rune in time.
Projectile travel time gives a reaction window.

## NETCODE

Stream hand keypoints or cast results, never video. Slow draws and projectile
travel absorb network lag.

## PLATFORM

Web. Laptop webcam. Framed upper body.

## SCOPE PLAN

One engine, two modes. Build the 1v1 duel first. A stripped single-objective
siege mode comes later on the same engine. Do not build a full MOBA. Do not
build two separate games.

## CURRENT PHASE

Recognition harness only. Prove a webcam tells eight to ten runes apart, fast
and clean, before any game logic. No spells, no health, no networking yet.

## GUARDRAILS

Use @mediapipe/tasks-vision, never @mediapipe/hands. Vanilla JS for the
harness. Commit after each step. Stop at the scope of the current task. Ask
before adding systems beyond the current phase.

## OPEN QUESTIONS

Final rune vocabulary, decided with recognition results. Pen-up pen-down feel
under pressure. Players assumed remote, each with their own camera. Duel win
condition details.
