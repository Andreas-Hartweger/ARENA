# Projektanweisungen

1. Lies vor Änderungen die relevante Projektdokumentation und vorhandene lokale Anweisungen.
2. Bearbeite ausschließlich ausdrücklich freigegebene Aufgaben.
3. Implementiere keine ungeplanten Spielmechaniken.
4. Respektiere vorhandene Dateien und fremde Änderungen.
5. Halte den Code modular, verständlich und für beide Entwickler erklärbar.
6. Verwende englische Namen für Code, Module und Dateien.
7. Schreibe Projektdokumentation auf Deutsch.
8. Trenne Simulation, Grafik, KI und Benutzeroberfläche.
9. Vermeide unnötige Abhängigkeiten. Zusätzliche Frameworks erfordern Freigabe.
10. Teste relevante Änderungen.
11. Dokumentiere tatsächlich ausgeführte Arbeit und Prüfergebnisse.
12. Melde Fehler und ausstehende oder übersprungene Prüfungen.
13. Verwende keine destruktiven Git-Befehle.
14. Führe keine automatischen Pushes oder Merges durch.
15. Beginne nach Abschluss keine weitere Aufgabe ohne ausdrückliche Freigabe.

WebStorm ist die gemeinsame Entwicklungsumgebung. Änderungen werden gegenseitig überprüft. Die Entwickler müssen die Foundation vor der Umsetzung weiterer Spielmechaniken ausdrücklich freigeben.

## Ausnahme für Development Batch 01

Der Auftraggeber gibt FD-004 bis FD-007 trotz offener gemeinsamer G-07-Abnahme zur zusammenhängenden vorläufigen Entwicklung frei. Nach vollständiger Prüfung sind Commits eigener Änderungen, Pushes mit `git push -u origin HEAD` ausschließlich auf `feature/batch-01-complete-first-drive`, ein gemeinsamer PR nach main und das Abfragen der CI erlaubt. Die Fortsetzung innerhalb dieser vier Pakete erfolgt automatisch. Menschliches Review und Merge-Freigabe bleiben separat. Force-Push, destruktive Git-Befehle, Release-Tagging, neue Abhängigkeiten und First Intelligence sind ausgeschlossen.

## Development Batch 02A

Nach der gemeinsamen D00/G07-Abnahme sind PRE-01–03 und FI-001–012 freigegeben. B dokumentiert Tests, offene Entscheidungen und Übergaben unter docs/team. Geprüfte eigene Änderungen dürfen ausschließlich auf feature/batch-02a-ai-perception-brain mit git push -u origin HEAD gesichert werden. Ein gemeinsamer PR nach main und CI-Prüfung sind erlaubt. Review und Merge-Freigabe erfolgen separat. Neue Abhängigkeiten, Force-Push, Tags und Batch 02B sind ausgeschlossen.

## Development Batch 02B

Für PRE-B01 und EV-001–013 gilt der Auftrag vom 27.11.2026. A und B haben die gemeinsame Abnahme von 02A bestätigt. B arbeitet auf `feature/batch-02b-ai-evolution`. Geprüfte eigene Änderungen dürfen mit `git push -u origin HEAD` auf diesem Branch gesichert werden. Ein gemeinsamer PR nach main und CI-Prüfung sind erlaubt. A/B prüfen die Ergebnisse unabhängig. Ein Merge braucht die gesonderte Freigabe von A. Neue Abhängigkeiten, Force-Push, Tags und Folgepakete bleiben ausgeschlossen.

## Development Batch 02C

Nach dem Merge von PR #6 und erfolgreicher CI gibt A PRE-C01 und die 17 Folgeaufgaben im [02C-Arbeitsplan](docs/training-management/specification/BATCH-02C_TASKS.md) frei. Für die Arbeit gelten [TR-01 bis TR-08](docs/team/DEVELOPMENT_CONTINUITY_CONTRACT.md). Geprüfte eigene Änderungen dürfen ausschließlich auf `feature/batch-02c-training-model-management` mit `git push -u origin HEAD` gesichert werden. Ein gemeinsamer PR nach main und CI-Prüfung sind freigegeben. Den 02C-Merge entscheidet A gesondert.

## Development Batch 02D

A erteilt mit Prompt und Paket v0.11 die bedingte Mergefreigabe ausschließlich für den Vorgänger-PR #7. PRE-D01 prüft alle Pflichtnachweise und das unabhängige A/B-Review. Nach dem Merge, erfolgreicher CI auf dem tatsächlichen Mergecommit und lokaler Baseline bearbeitet B die 14 Arbeitspakete gemäß [Arbeitsplan](docs/intelligence-validation/specification/BATCH-02D_TASKS.md). Geprüfte eigene Commits und Pushes sind auf `feature/batch-02d-integration-training-validation` begrenzt. Für diesen Branch sind ein PR nach `main` und die Prüfung seiner CI freigegeben. Über den Merge von 02D entscheidet A gesondert. TR-01 bis TR-08 und die [Forschungsbudgets](docs/intelligence-validation/specification/BUDGET_COMPUTE_SPEC.md) gelten.
