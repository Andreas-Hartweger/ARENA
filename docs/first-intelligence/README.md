# ARENA · Batch 02A – Übergabepaket v0.8

Stand 25.11.2026. Basis main `68e8d1051a5ea01d544cc1496917568c25b59b92`; PR #4 gemergt; main-CI [erfolgreich](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45613045498), zuletzt im vorangegangenen Chat geprüft. Nicht erneut ausgeführt. D08 40/40, D09 45/45, TF-01–18 technisch ausgearbeitet. A plant, B implementiert. A hat den gemeinsamen Auftrag unter der Bedingung freigegeben, dass alles passt; das ersetzt keine gemeinsame menschliche Abnahme. **Vor KI-Code: G07 und Review dokumentieren oder ausdrücklich genehmigte Ausnahme.** Keine automatische main-Zusammenführung.

## Verwendung

1. ZIP entpacken; Ordner vollständig an B geben, zusammen mit Masterplan v0.8 und dem separat vorliegenden Codex-Prompt. B legt die autorisierten Spezifikationen unter `docs/first-intelligence/` ab; Teamdateien mit seinen vorhandenen Entwürfen zusammenführen, nicht überschreiben.
2. B fügt den Prompt in Codex ein. Der Auftrag enthält PRE-01–03 und FI-001–012. Einmalige gemeinsame Abnahme im selben Auftrag, keine neue Fragerunde pro FI-Paket.
3. B legt die Ergebnisse auf dem freigegebenen Branch ab und meldet PR/CI/Reviewstatus. Kein Training vor 02B. A plant während der Implementierung D10/D11.

## Dateien

- BATCH-02A_SPECIFICATION.md: Scope, Architektur, Gates und Quellen.
- DECISIONS_D08_D09.md: alle 85 bestätigten Entscheidungen + Zukunftsziele.
- SENSOR_SYSTEM_SPEC.md: TF-01–07, Sichtschutz, Sensorprofil.
- OBSERVATION_SCHEMA.md / observation_channels.csv: TF-08–09, exakte 248 Indizes.
- NEURAL_NETWORK_SPEC.md: TF-10–12.
- AI_CONTROLLER_SPEC.md: TF-13–15, gemeinsame Steuerung und Transaktionen.
- AI_INSPECTOR_SPEC.md: TF-16.
- BATCH-02A_TASKS.md / BATCH-02A_TESTS.md: Arbeit und Abnahme, TF-17–18.
- ARENA_HANDOVER_002.md: Baseline, offene Punkte, Freigaberegeln und Teamworkflow.
- BATCH-02A_CODEX_PROMPT.md: vollständiger Startauftrag.

Technische Präzisierungen (z. B. Sichtbeweis, Tie-Regeln, Testtoleranzen) sind abgeleitete Implementierungsregeln, keine neuen Nutzerentscheidungen. Bei Konflikten mit bestätigten Regeln oder dem realen Code: betroffene Aufgabe stoppen, reproduzieren, Entscheidung anfordern. Die Spezifikation ist erstellt, nicht implementiert oder getestet. B's lokale Entwürfe sind nicht vorliegend; keine erfundenen Inhalte.
