# Aktuelle Übergabe · Batch 02D

A bestätigte im Auftragschat den geprüften Stand von PR #7 und die Übernahme des administrativen SYS-03-Abschlusses. PR #7 wurde als `e6a95a92b6241a750ba7fff599ff2dac123c3149` gemergt. Die [CI auf main](https://github.com/Andreas-Hartweger/ARENA/actions/runs/46073023305) sowie lokal `npm ci`, `npm run check` (233 Tests) und `npm run calibrate` bestanden. Die Kalibrierwerte stimmen mit der 02B-Referenz überein. [PRE-D01](../intelligence-validation/PRE-D01.md)

Die sechs Baselines und ihre zwölf Vergleiche auf je 40 Entwicklungsfällen sind ausgewertet. Der beste Baseline-Champion erreichte 21/40. Das gepaarte Screening läuft auf `160db2c` mit 14 Workern, dauerhaften Checkpoints und Budgetledger. In PR #8 ist A als unabhängiger Reviewer angefragt. Das Technical Gate und die Model Readiness sind offen. [Forschung](../intelligence-validation/RESEARCH_EXECUTION.md) · [Prüfstatus](../intelligence-validation/ACCEPTANCE_RESULTS.csv) · [Review](https://github.com/Andreas-Hartweger/ARENA/pull/8)

Die erste Stundenprüfung erreichte 644.736 neu gebuchte Trainingsepisoden und 1.293.958.291 Fahrzeugticks. 70 Screeningläufe waren abgeschlossen. Die Validierungsreserve war vollständig verfügbar. [Budget und Stand der einzelnen Läufe nach zwölf Stunden](../intelligence-validation/evidence/budget-12h.json)

## Abschlussübergabe Batch 02C

Am 27.11.2026 erteilte A die bedingte Merge-Freigabe und delegierte die verbleibenden Review- und Abnahmeschritte. Codex prüfte den Stand von B `6818084` gegen `61cd54a`, insbesondere physische Kontaktkorrekturen, interpolierte Ziellinie, Fehlerisolation und deterministische Reproduktion. Der Datenabgleich aus der Übergabe umfasst 12.800 Ergebnisse und 594 Elite-Neubewertungen. [PR #6](https://github.com/Andreas-Hartweger/ARENA/pull/6) wurde als `c74ab27daf3159329d9049076ab3c30c5a4759ea` gemergt. Die [CI auf main](https://github.com/Andreas-Hartweger/ARENA/actions/runs/46009031010) bestand.

Die 18 freigegebenen Pakete von 02C werden in [PR #7](https://github.com/Andreas-Hartweger/ARENA/pull/7) übergeben. Der serielle und der parallele Chromium-Lauf stimmen über 100 Generationen mit je 128 Kandidaten überein. Die UI- und Speicherprüfungen sind bestanden. A hat den Headless-Prüfpunkt mit dem Sollwert 2 Stunden nach Abbruch geschlossen. Im letzten Endabnahmelauf sind 50,08 s gemessen, im längsten Vorlauf 96 min 7 s. Der [02C-Bericht](../training-management/BATCH-02C_COMPLETION_REPORT.md) führt Ergebnisse, Laufherkunft und den eigenständigen Freigabestatus des PR auf.

## Historische Übergabe vor dem 02B-Review

PRE-B01 und EV-001–012 sind technisch abgeschlossen. EV-013 ist von B übergeben. Das unabhängige A/B-Review von 02B (REL-003) und die ausdrückliche Merge-Freigabe durch A stehen aus. [PR #6](https://github.com/Andreas-Hartweger/ARENA/pull/6) ist der gemeinsame Review-PR nach main.

Der echte Referenzlauf wertete G0–G99 mit jeweils 128 Modellen aus. 12.800 gültige Kandidatenergebnisse, 664 gültige Runden, 594 erneut geprüfte Eliten. Der lokale Check bestand 213 Tests in 29 Dateien. Die Kalibrierung entsprach PRE-B01. Die Referenz lief auf `44c100c22854793b200a104dbc358e49ea9190fa`. Stand der Fehlerbehandlung und der vollständigen automatisierten Tests ist `8f0d57eda7ffca3e855cd50825a890424056c753`.

[Abschlussbericht](../first-evolution/BATCH-02B_COMPLETION_REPORT.md) · [Abnahmematrix](../first-evolution/ACCEPTANCE_RESULTS.md) · [Referenzaudit](../first-evolution/evidence/reference-audit.json) · [Bedienung und Wiederholung](../first-evolution/README.md)

DR-02B-001 ist entschieden. Die von A delegierte Grenze beträgt 1–1.000.000 Aufgabenrunden. [Entscheidungsprotokoll](DECISION_REQUESTS.md)

**NÄCHSTER PLANUNGSAUFTRAG ERFORDERLICH.** D12/D13 und D14 erfordern eine neue Freigabe.

## Vorherige Übergabe · Batch 02A

Batch 02A ist abgeschlossen. [PR #5](https://github.com/Andreas-Hartweger/ARENA/pull/5) wurde am 25.11.2026 als `b2af946` in `main` gemergt. Die [CI auf `main`](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45670859286) war erfolgreich. Alle 160 Tests bestanden. Die Prüfergebnisse und Benchmarks stehen im [Abschlussbericht](../first-intelligence/BATCH-02A_COMPLETION_REPORT.md).

Am 27.11.2026 übergab A das Paket v0.9. Die gemeinsame 02A-Abnahme ist im [Log](HANDOVER_LOG.md) bestätigt. PRE-B01 ist technisch geprüft. B übernimmt EV-001–013 auf `feature/batch-02b-ai-evolution`. Review 02B und Merge-Freigabe stehen aus.
