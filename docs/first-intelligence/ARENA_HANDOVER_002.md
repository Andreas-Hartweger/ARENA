# Handover 002 – A → B · Batch 02A

25.11.2026 · Basis `68e8d1051a5ea01d544cc1496917568c25b59b92` · First Drive 0.2.0-rc.1 · Planung D08/D09 85/85. Übergabe unter Bedingung der noch offenen menschlichen G07-/Review-Abnahme. Kein neuer Code oder Push durch A in diesem Paket. B's Entwürfe außerhalb des Checkouts nicht einsehbar; B führt sie mit dieser Vorgabe zusammen.

## Status / Belege

- Main CI erfolgreich laut vorheriger direkter Abfrage [45613045498](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45613045498), PR #4 gemergt. Keine offenen PRs zum Zeitpunkt der Abfrage. B überprüft erneut.
- B-Bericht: 134 Tests/18 Dateien, 28 Wiederholungstests; 0–100 3.816667 s, vmax 248.341174 km/h, 100–0 31.174882 m, reverse 29.675641 km/h. Browser-Replay 1:05.93 / 1:06.10, persönliche Fahrprobe PASS; subjektives Fahrgefühl offen. Echter Alt+Tab NOT RUN, gemeinsame Abnahme offen. Kein erfundener PASS.
- A und B müssen gegenseitiges Review und D00/G07 ausdrücklich bestätigen. B sammelt die fehlenden Nachweise im selben Auftrag. Kein KI-Code bevor Gate erfüllt oder A+B ausdrücklich begrenzte Ausnahme dokumentieren. A's bedingte Freigabe ist kein Ersatz für B's Abnahme. Kleine HUD-Korrekturen freigegeben im Batch, kein Physik-Retuning.

## Teamdateien (vorhandene Entwürfe respektieren)

Unter `docs/team/` (oder bestehender konsistenter Pfad):

- DEVELOPMENT_QUEUE.md: ID, Scope, Abhängigkeiten, Owner, Freigabe, Status, Test-/PR-Link. PRE + FI freigegeben unter Gate; 02B–D, Batch03 In Planung, keine Ausführung.
- DEVELOPMENT_PROGRESS.md: pro Task Start/Ende, tatsächliche Tests, Commit und Remote-SHA, Abweichungen, Blocker. Kein Prozentwert ohne Bezug.
- DECISION_REQUESTS.md: offene Entscheidung, betroffene Task, Ursache, Alternativen, Empfehlung, Auswirkungen, SHA. Status offen/entschieden, Entscheidung durch A dokumentieren.
- HANDOVER_CURRENT.md: wer gerade Writer ist, Branch, SHA lokal/remote, clean/dirty, CI/PR, letzte Checks, offene Prüfungen, nächster erlaubter Auftrag. HANDOVER_LOG.md append-only Historie, frühere Einträge erhalten.
- AGENTS.md: gezielte Ausnahme für PRE/FI-001–012. Automatische Commits/Push nur `feature/batch-02a-ai-perception-brain`, PR/CI erlaubt, keine Merges/Tags/force push/neue Abhängigkeiten. Nicht bestehende globale Regeln unkontrolliert ersetzen.

## Ablauf

Ausgehender Entwickler stoppt Schreibzugriff, prüft Arbeitsbaum, Tests und remote SHA; Empfänger fetch/prüft identische Basis, setzt auf freigegebener Branch fort. Keine konkurrierenden Writer. Codex darf innerhalb freigegebener Aufgaben selbstständig arbeiten, reversible Details entscheiden, Tests/Fixes/Docs ausführen, Commit/Push und PR. Keine automatische Hintergrundfortsetzung nach beendeter Session zugesichert. Wenn Grundsatzproblem: `PLANUNGSENTSCHEIDUNG ERFORDERLICH`, betroffener Task blockiert, unabhängige freigegebene Tasks weiter. Wenn Queue leer: `NÄCHSTER PLANUNGSAUFTRAG ERFORDERLICH`, sicherer Checkpoint. Status: In Planung / Freigegeben / In Arbeit / Automatisch geprüft / Auf GitHub gesichert / Review ausstehend / Abgeschlossen / Blockiert. Finale menschliche Abnahme und Merge ausdrücklich separat.

A plant D10/D11 nach Übergabe; B beginnt kein Evolutionstraining in 02A. D12/D13 und D14 folgen in 02C/02D. Bei Änderungen des Baseline-SHA zunächst Differenz und Konflikte prüfen, nicht resetten. Alle Dokumente im Paket nutzen, README als Index.
