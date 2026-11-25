# Batch 02A – verbindlicher Umfang und Architektur

Stand 25.11.2026 · Spezifikation v0.8 · Planungsleitung A, Umsetzung B. Grundlage D08/D09 (85 Antworten), TF-01–18, Bedingung aus letzter Freigabe: offene First-Drive-Aufgaben im selben Auftrag.

## 1. Gate und Baseline

- Start von verifiziertem `main` `68e8d1051a5ea01d544cc1496917568c25b59b92`; falls neuer main-Stand, Diff und CI prüfen, fremde Arbeit nicht zurücksetzen. Branch-Vorschlag `feature/batch-02a-ai-perception-brain`. Ein aktiver Writer; kein main-Merge ohne getrennte ausdrückliche Erlaubnis.
- [PR #4](https://github.com/Andreas-Hartweger/ARENA/pull/4), [Batch CI](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45613019129), [main CI](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45613045498). B-Bericht 25.11.2026: 134/134 Tests (18 Dateien); 28/28 gezielte Wiederholungen; native Alt+Tab nicht getestet; persönlicher Fahrtest PASS mit subjektivem Feedback „war nicht schön“; zwei Runden 1:05,93 und 1:06,10 aus automatisiertem Replay. Keine persönliche Rundenfahrt daraus ableiten. CI bestätigt im vorigen Chat, nicht neu ausgeführt.
- PRE-01: G07/Review durch beide Menschen bestätigen und echten Alt+Tab prüfen; Codex bereitet vor, kann nicht selbst menschliche Abnahme aussprechen. Wenn native Eingabe blockiert, B fährt manuell und meldet Ergebnis. Kein erfundener PASS. Falls Gate offen: unabhängige Doku/Prüfung vorbereiten, kein KI-Code ohne ausdrücklich dokumentierte Ausnahme von A und B. Vorläufige Freigabe der Batchaufgaben unter bestandenen Gates; keine weitere Freigabe pro FI-Aufgabe. Siehe Handover.
- PRE-02: Teamdokumente auf Basis von B's Entwürfen, targeted AGENTS-Regel. PRE-03: Recovery-Hinweis nach 180 aktiven Physikticks ausblenden (Pause friert; erneuter Recovery startet Frist); F3 „Grip-Auslastung“ + verfügbare Achskraft in N; UI-only; kein Fahrgefühl-Tuning. Bestehendes Recovery/Physik/Lap-Verhalten unverändert.

## 2. Ziel und Grenzen

02A = vollständige Wahrnehmungs-/Inference-/Steuerungskette, deterministisch und headless + sichtbarer interner Testmodus. Kein Fitness, Mutation, Selektion, Population, Trainings-UI, persistenter Modellimport, trainiertes Startermodell, Rennen-Menü, Minikarte-Upgrade, neue Strecke, Kamera/Radar/LiDAR, neue Dependencies. Keine Garantie guter Runden mit Zufallsgewichten. Modellfixture niemals als trainiert bezeichnen. 02B D10/D11, 02C D12/D13, 02D D14 (Lernnachweis), Batch03 D15–D23 (Complete Foundation). Keine neue Spielmechanik.

## 3. Architektur

- Bestehender TS/React/Three/Vite/Node24/npm/Vitest/ESLint/Prettier-Stack. Keine externe ML-/Physikbibliothek. Englisch im Code, Deutsch in Projektdoku. Core ohne DOM/React/Three, ES2022 Headless-Build. Vorschlag: `src/ai/perception`, `src/ai/network`, `src/ai/control`, `src/ai/runtime`, `src/ai/diagnostics`; B entscheidet konkrete Dateistruktur, vermeidet zyklische Imports.
- SI; Welt x rechts/y oben, heading CCW +x; local x vorwärts, y links. Geometrische Winkel positiv links; ControlInput.steering negativ links. Physik 60 Hz; Sensor und Inference 30 Hz standard. Graphik interpoliert nur publizierte Frames. Standardprofil GT-01 4,5 × 1,95 m, 16 Rays, sieben Vorschaupunkte, vier Objektplätze, 248 Kanäle, MLP 248→32→16→3, 8.547 Parameter. Gemeinsame Modellgewichte read-only, individuelle Laufzeitzustände.
- Sichtdaten und Egozustand als schmaler Sensor-Input; keine Lap-/Checkpoint-/ID-/Weltkartenfelder im Netzwerk. Privilegierte Debug-/Fitnessdaten bleiben getrennt. Geometrie aus vorhandenem Track; analytische SurfaceQuery und tessellierte Barrieren beachten. Kein Lernen in 02A; Modelle unveränderlich während Evaluation.
- Simulationsframe n lesen → alle fälligen Beobachtungen und Entscheidungen aus demselben Weltzustand vorbereiten → 60-Hz-Adapter → bestehende Physik/Kontakte/Fortschritt → atomare Veröffentlichung von Welt + KI-Zuständen. Fehler sperrt Session; keine partiellen Zustände. Inspector ausschließlich lesend. Weitere Details in Teil-Spezifikationen.

## 4. Akzeptanz

Alle Pflichtfälle in BATCH-02A_TESTS.md PASS oder begründet als offen (dann keine finale Abnahme); `npm ci` bei Bedarf, `npm run check`, `npm run calibrate` und echte Browserproben. Vorhandene 134 Tests nicht löschen/abschwächen; Referenz 0–100 3,816667 s, Vmax 248,341174 km/h, Bremsweg 31,174882 m, Dauer 2,283333 s, reverse 29,675641 km/h, bestehende Toleranzen unverändert. Testberichte inkl. Hardware, SHA, Befehle, Rohmessungen. Benchmark ohne willkürliche Mindesttrainingsrate; Nachweis optimierter Suche gegen Referenz, bei Nichtverbesserung transparent berichten. Technische Freigabe ≠ menschliche Abnahme.

## 5. Quellen im Repo

Basis [main] (https://github.com/Andreas-Hartweger/ARENA/tree/68e8d1051a5ea01d544cc1496917568c25b59b92); relevante Dateien: `AGENTS.md`, `docs/first-drive/FIRST_DRIVE_SPEC.md`, `src/input/controlInput.ts`, `keyboardControls.ts`, `src/physics/vehicleTick.ts`, `surface.ts`, `handling.ts`, `vehicleDynamics.ts`, `src/game/world.ts`, `src/tracks/track.ts`, `src/core/random.ts`. Quellcode dieser Kernstellen wurde im vorigen Chat gelesen; kein vollständiger neuer Review. `resolveControlTick` wechselt nur bei throttle>0/brake=0, Tastatur ramped separat, direkte analoge Kalibrierung darf nicht verändert werden; `sampleAxles` ist eine reine Kandidatenberechnung, nicht zweimal committen. B prüft die tatsächlichen Dateien vor Änderungen. Ältere Excel-Schätzungen sind historische Richtwerte, keine verbindlichen Deadlines.
