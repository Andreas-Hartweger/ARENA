# Entwicklungswarteschlange

## Batch 02C

Die 18 Arbeitspakete und ihre Lieferergebnisse stehen im [02C-Abschlussbericht](../training-management/BATCH-02C_COMPLETION_REPORT.md). Die 210 Abnahmepunkte und 96 Entscheidungen sind in der [Prüfmatrix](../training-management/ACCEPTANCE_RESULTS.md) einzeln zugeordnet. SYS-03 enthält die von A verkürzte Headless-Dauerprüfung. Das unabhängige 02C-Schlussreview und die Mergefreigabe stehen aus. [Arbeitsplan](../training-management/specification/BATCH-02C_TASKS.md) · [Referenzvergleich](../training-management/evidence/node-pool-reference.json)

## Frühere Arbeitspakete

Batch 02A ist abgeschlossen. [PR #5](https://github.com/Andreas-Hartweger/ARENA/pull/5) wurde am 25.11.2026 als `b2af946` in `main` gemergt. Die [CI auf `main`](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45670859286) war erfolgreich.

| Umfang          | Owner               | Freigabe / Status | Ergebnis und Abhängigkeiten                                                                                                                                                                                     |
| --------------- | ------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PRE-01          | A und B             | Abgeschlossen     | D00/G07 gemeinsam bestätigt, Alt+Tab manuell gemeldet                                                                                                                                                           |
| PRE-02/03       | B                   | Abgeschlossen     | Handover 002, HUD-Prüfungen PRE-003–005                                                                                                                                                                         |
| FI-001–012      | B, Review durch A/B | Abgeschlossen     | [Paketabhängigkeiten](../first-intelligence/BATCH-02A_TASKS.md), [Ergebnisse je Paket](../first-intelligence/BATCH-02A_COMPLETION_REPORT.md), [PR #5 und CI](https://github.com/Andreas-Hartweger/ARENA/pull/5) |
| 02C–D, Batch 03 | Planung A           | In Planung        | Neuer Planungsauftrag und ausdrückliche Freigabe erforderlich                                                                                                                                                   |

## Batch 02B · Stand vom 27.11.2026

PRE-B01 und EV-001–013 sind abgeschlossen. A delegierte die ausstehenden technischen Review- und Abnahmeschritte und erteilte die Merge-Freigabe. PR #6 wurde als `c74ab27` integriert. [CI auf main](https://github.com/Andreas-Hartweger/ARENA/actions/runs/46009031010)

| Paket   | Ergebnis                                                                                                    | Stand                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| PRE-B01 | Gemeinsame 02A-Abnahme, SHA-Abgleich, Installation, 160 Basistests und Kalibrierung                         | 61cd54a                                                           |
| EV-001  | Paket v0.9 archiviert, Anweisungen und Teamworkflow begrenzt freigegeben                                    | 62accac                                                           |
| EV-002  | Atomare akzeptierte Weg-, Tor- und Kontaktfakten aus dem Solver und Rundenprüfer                            | fbce904, 0da4604                                                  |
| EV-003  | Fitnessprofile, Fortschrittsledger und Belastungen einschließlich Korrekturüberlappung und Rundenzahlgrenze | 0da4604, 44c100c                                                  |
| EV-004  | Frische Episoden, Prioritäten der Zeitgrenzen, Zielinterpolation und Fehlerherkunft                         | fbce904, 1768651, bb9d721                                         |
| EV-005  | Modellverträge, unveränderliche Genome, Identitäten und getrennte RNG-Streams                               | fbce904, 44c100c                                                  |
| EV-006  | Tournament, Eliten, Uniform- und neuronweiser Crossover                                                     | fbce904, 29376ab                                                  |
| EV-007  | Gemischte Gauß-Mutation, Schichtschutz und Detailstatistik                                                  | fbce904, 0da4604                                                  |
| EV-008  | Initialisierung, Bewertung ganzer Populationen, Budgetende und Champion                                     | fbce904, 44c100c                                                  |
| EV-009  | Diversity, Stagnation, Adaption, Immigrants und Rescue                                                      | fbce904, ae3a2a7                                                  |
| EV-010  | Atomare Generationen, Evaluator-Isolation, Fehlerstatus und Reproduktion                                    | 44c100c, bb9d721, cd3d343                                         |
| EV-011  | Kompakte Snapshots, begrenzte echte Traces und Herkunft                                                     | 0da4604, 44c100c, 1768651                                         |
| EV-012  | 213 Tests, Kalibrierung, Browser, Benchmarks und 12.800 echte Evaluationen                                  | [Referenzaudit](../first-evolution/evidence/reference-audit.json) |
| EV-013  | Bericht, 103 Entscheidungen, 128 Abnahmepunkte und ein gemeinsamer PR. REL-003 offen                        | [PR #6](https://github.com/Andreas-Hartweger/ARENA/pull/6)        |

[Abschlussbericht](../first-evolution/BATCH-02B_COMPLETION_REPORT.md) · [Abnahmematrix](../first-evolution/ACCEPTANCE_RESULTS.md)

Der anschließend freigegebene Auftrag ist Batch 02C gemäß v0.10.

## Batch 02D · Vorbereitung

PRE-D01 ist abgeschlossen. Der Hauptauftrag beginnt mit RS-001, Experimentverträgen und Budgetabrechnung. [Gate](../intelligence-validation/PRE-D01.md)

Die 122 Experimentdefinitionen, das Budgetledger, vier historische Modellrollen und der reale Wiederanlauf sind geprüft. 14 Worker erzielten im gepaarten Vergleich den höchsten Median von 19.638 Fahrzeugticks/s. Seed 42 wurde aus den verifizierten Originaldaten übernommen. Alle sechs Baselines einschließlich der drei Zufallssuchen sind nach je 100 Generationen auditiert. Nächster Schritt sind die 40 Entwicklungsfälle und das gepaarte Screening. [Forschungsstand](../intelligence-validation/RESEARCH_EXECUTION.md) · [158 Abnahmepunkte](../intelligence-validation/ACCEPTANCE_RESULTS.csv)
