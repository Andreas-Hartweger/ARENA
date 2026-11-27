# Übergabe an A und B · Batch 02B

PRE-B01 und EV-001–012 sind technisch abgeschlossen. EV-013 ist von B übergeben. Das unabhängige A/B-Review von 02B (REL-003) und die ausdrückliche Merge-Freigabe durch A stehen aus. [PR #6](https://github.com/Andreas-Hartweger/ARENA/pull/6) ist der gemeinsame Review-PR nach main.

Der echte Referenzlauf wertete G0–G99 mit jeweils 128 Modellen aus. 12.800 gültige Kandidatenergebnisse, 664 gültige Runden, 594 erneut geprüfte Eliten. Der lokale Check bestand 213 Tests in 29 Dateien. Die Kalibrierung entsprach PRE-B01. Die Referenz lief auf `44c100c22854793b200a104dbc358e49ea9190fa`. Stand der Fehlerbehandlung und der vollständigen automatisierten Tests ist `8f0d57eda7ffca3e855cd50825a890424056c753`.

[Abschlussbericht](../first-evolution/BATCH-02B_COMPLETION_REPORT.md) · [Abnahmematrix](../first-evolution/ACCEPTANCE_RESULTS.md) · [Referenzaudit](../first-evolution/evidence/reference-audit.json) · [Bedienung und Wiederholung](../first-evolution/README.md)

DR-02B-001 ist entschieden. Die von A delegierte Grenze beträgt 1–1.000.000 Aufgabenrunden. [Entscheidungsprotokoll](DECISION_REQUESTS.md)

**NÄCHSTER PLANUNGSAUFTRAG ERFORDERLICH.** D12/D13 und D14 erfordern eine neue Freigabe.

## Vorherige Übergabe · Batch 02A

Batch 02A ist abgeschlossen. [PR #5](https://github.com/Andreas-Hartweger/ARENA/pull/5) wurde am 25.11.2026 als `b2af946` in `main` gemergt. Die [CI auf `main`](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45670859286) war erfolgreich. Alle 160 Tests bestanden. Die Prüfergebnisse und Benchmarks stehen im [Abschlussbericht](../first-intelligence/BATCH-02A_COMPLETION_REPORT.md).

Am 27.11.2026 übergab A das Paket v0.9. Die gemeinsame 02A-Abnahme ist im [Log](HANDOVER_LOG.md) bestätigt. PRE-B01 ist technisch geprüft. B übernimmt EV-001–013 auf `feature/batch-02b-ai-evolution`. Review 02B und Merge-Freigabe stehen aus.
