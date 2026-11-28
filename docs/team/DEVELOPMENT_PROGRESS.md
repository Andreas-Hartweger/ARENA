## 25.11.2026

PRE-01: Lokaler Node 24.22.3, 134/134 Tests in 18 Dateien, npm run check und calibrate erfolgreich. 0–100 in 3,816667 s, Spitze 248,341174 km/h, Bremsweg 31,174882 m in 2,283333 s, rückwärts 29,675641 km/h. PR #4 gemergt, main-CI 45613045498 erfolgreich. Vite meldete ein Bundle über 500 kB. Alt+Tab manuell bestätigt, gemeinsame Freigabe im Übergabelog.

PRE-02: Die Teamdateien wurden aus Handover 002 angelegt. Im Checkout, den durchsuchten lokalen Dokumenten, Downloads und Worktrees lagen keine separaten Handover-Entwürfe. Der Nutzer bestätigte, dass ihm keine weiteren Entwürfe vorliegen. Grundlage ist Handover 002.

## 25.11.2026 · Übergabe von PRE-03 und FI-001–012

PRE-02 und PRE-03 sind geprüft. Das vollständige Spezifikationspaket und die Abnahme liegen ab `b8d32cc` auf der Feature-Branch. FI-001–010 wurden in `9003d0c` integriert und in `b1995a3` mit weiteren Geometrie-, Kontroll- und Browserprüfungen abgesichert. Die gemessenen Daten für FI-011 und die Einzelzuordnung jedes Pakets stehen im [Bericht](../first-intelligence/BATCH-02A_COMPLETION_REPORT.md). FI-012 übergibt [PR #5](https://github.com/Andreas-Hartweger/ARENA/pull/5) zum menschlichen Review. Beginn und technischer Abschluss aller Pakete erfolgten am 25.11.2026. Der Bericht enthält die tatsächlich vorhandenen Belege für die menschlichen Prüfungen.

## 25.11.2026 · Technische Nachprüfung von PR #5

Fünf neue Regressionen für SEN-009, OBS-004, NN-001 und CTL-001 wurden vor der Korrektur reproduziert. B prüfte den korrigierten Sensor, die Konsistenzprüfung und die Inspector-Bedienung. Die Vorberechnung statischer Geometrie in `826e907` wurde zusätzlich auf 8192 identischen Strahlen mit der Vorversion verglichen. Zusammen mit dem zusätzlichen Tangententest bestanden 160 Tests. Die [Nachprüfung und Rohdaten](../first-intelligence/BATCH-02A_COMPLETION_REPORT.md#technische-nachprüfung-nach-übergabe-von-pr-5) ergänzen die ursprüngliche Übergabe.

## 27.11.2026 · PRE-B01 und EV-001

Arbeitsbaum vor Beginn sauber. Nach Fetch stimmen main, origin/main und ls-remote bei `61cd54a2be454915647b9089bc6da5c5d1bc16d8` überein. Gegenüber der erwarteten Basis `b2af9465976c7638b391074f8e241933dfcd53c5` änderte ein Commit nur den 02A-Bericht, die Queue und die aktuelle Übergabe. Beide main-CIs waren erfolgreich. Node 24.22.3, npm 11.19.1, npm ci erfolgreich. Der vollständige lokale Check bestand mit 160 Tests in 23 Dateien. Vite meldete ein 838,03-kB-Bundle. Kalibrierung erfolgreich: 0–100 in 229 Ticks, Spitze 248,341174 km/h, Bremsweg 31,174882 m in 137 Ticks, Rückwärtsfahrt 29,675641 km/h.

Quellreview: solveContacts hält das Wegende vor der Positionskorrektur fest und verwirft ambige Substeps. Leichte Kontakte fehlen im HUD. recordTravel entwertet certified und verarbeitet gerichtete Tore. DriveWorld projiziert die korrigierte Endposition nochmals und veröffentlicht erst nach Zustandsvalidierung. Brain kopiert Float64-Parameter, Bias folgen den Gewichten jeder Schicht. Treiber und SeededRandom bleiben Eigentümer von Inferenz und Mulberry32. Paketoriginale unter [specification](../first-evolution/specification/), SHA-256 des ZIPs `1daf8a94c346260b769167fda32937bb178ce7bec63475c0fcff5dce4a8f96e1`, des Masterplans `c22dabb0597c71879a7b76297a1be6a3de4aa46869cedb07e5dfa878ab3eff82`. Gemeinsame Abnahme siehe [Übergabelog](HANDOVER_LOG.md).

## 27.11.2026 · Batch 02B zum unabhängigen Review

PRE-B01 und EV-001–012 sind technisch abgeschlossen. EV-013 ist von B übergeben. Das unabhängige A/B-Review von 02B (REL-003) und die ausdrückliche Merge-Freigabe durch A stehen aus. Der echte Referenzlauf wertete G0–G99 mit jeweils 128 Modellen aus. 12.800 gültige Kandidatenergebnisse, 664 gültige Runden, 594 erneut geprüfte Eliten. Der lokale Check bestand 213 Tests in 29 Dateien. Die Kalibrierung entsprach PRE-B01. Die Referenz lief auf `44c100c22854793b200a104dbc358e49ea9190fa`. Stand der Fehlerbehandlung und der vollständigen automatisierten Tests ist `8f0d57eda7ffca3e855cd50825a890424056c753`. Die [Queue](DEVELOPMENT_QUEUE.md) ordnet alle 14 Pakete ihren Prüfständen zu. 207 Benchmarkfenster, ein Framevergleich mit 02A und drei Wiederholungen zu 200 kleinen Generationen belegen Laufzeit und Speicherverhalten. Das Referenzaudit prüft jeden Einzelrecord und jede Elite. [Abschlussbericht](../first-evolution/BATCH-02B_COMPLETION_REPORT.md) · [Abnahmematrix](../first-evolution/ACCEPTANCE_RESULTS.md) · [Referenzaudit](../first-evolution/evidence/reference-audit.json)

## 27.11.2026 · PRE-C01

`npm ci`, `npm run check` und `npm run calibrate` auf `c74ab27` bestanden. 213/213 Tests in 29 Dateien. Die Kalibrierung ergab 229 Ticks bis 100 km/h und 31,174882 m Bremsweg. Vite meldete 839,24 kB im JavaScript-Bundle. 26 ZIP-Einträge geprüft, darunter 96 Entscheidungen, 18 Pakete und 210 Prüfpunkte mit allen IDs im Excel-Masterplan. Beide XLSX-Fassungen haben denselben SHA-256 `d3f77841419bb6c61582ffd22df19243a3f1fdfdd2cef6a3f0d4b76bc19d5af6`.

Die 02B-Referenz und lokale Laufverzeichnisse enthalten Seed, Konfiguration, Herkunft, Genomhashes und Ergebnisdaten. Der Writer speicherte für G0, G31 und den finalen Champion keine Original-Parameterdateien. Die beiden gespeicherten Fahrlinien beruhen auf rekonstruierten Modellen. Originalbelege verbleiben in `docs/first-evolution/evidence`.

### Technischer Zwischenstand

Der gemeinsame Episodeniterator führt den bestehenden 02B-Tick aus. Der synchrone Evaluator nutzt denselben Pfad. Zwei echte Node-Worker ergaben in zwei kurzen Generationen identische Einzelergebnisse, Rangfolgen, Fitness und Folgegenome wie der serielle Lauf. SHA-256, Float64-Framing und CPU-Profile stimmen mit den unabhängigen Referenzvektoren überein. 216 Tests bestanden. Die vollständige Systemabnahme von 02C steht aus.

### 02C · Referenzvergleich und Speicherprüfung

Der isolierte Acht-Worker-Lauf auf `18839aa` wertete alle 12.800 regulären Episoden aus G0–G99 aus. Die Kandidaten-NDJSON stimmen bytegenau mit der 02B-Referenz überein. Alle 100 logischen Generationsstatistiken und der Championhash stimmen überein. Die CLI benötigte einschließlich Datei-I/O 983,43 s. [Messdaten](../training-management/evidence/node-pool-reference.json). Der Browser-Kurztest verwendete einen eigenen Coordinator-Worker und zwei Simulationsworker. Chromium bestätigte vier Generationen, drei erhaltene automatische Checkpoints und die Zurückweisung eines zweiten Writers. Der erste Testdeckaufbau verlor den ersten Befehl beim asynchronen Datenbankstart. Ein explizites Ready-Signal vor der Zustellung behebt dies.

### 02C · Integration und Dauerprüfung

Vier Laborbereiche, Erstellung und Klon von Modellen, Registry, portabler Transfer und Queue-Recovery sind auf `444d774` geprüft. `384165e` ergänzt die Messung der tatsächlich angezeigten Snapshots. Auf `1b99d13` besteht der unveränderte 02A-Weltvergleich auch im separaten Checkout. Die saubere Installation und der Projektcheck ergaben 233 bestandene Tests in 34 Dateien. Die UI absolvierte 189 Bedienzyklen während 20 min 3 s aktiver Messzeit. A beendete die Headless-Vorläufe um 19:07 Uhr und den einzelnen Endabnahmelauf um 19:14 Uhr. Der Sollwert von zwei Stunden und die tatsächlich gemessenen Zeiten stehen im Prüfprotokoll. [Prüfprotokoll](../training-management/evidence/checks.json) · [Dauerprüfung](../training-management/evidence/endurance/end.json)

Der serielle Chromium-Lauf endete bei G99. Alle 100 Generationsdaten, Folgepopulationen und der finale Champion sind identisch zum Vier-Worker-Lauf. Das unabhängige Kandidatenarchiv und die drei gespeicherten Championgewichte wurden offline nachgerechnet. [Vergleich beider Läufe](../training-management/evidence/browser-reference/end.json) · [Archivprüfung](../training-management/evidence/browser-reference/audit.json)

### 02D · PRE-D01

25 ZIP-Einträge, 24 Manifest-Prüfsummen und die separate Excel-Datei geprüft. 70 neue bestätigte Entscheidungen, 158 geplante Prüfpunkte und 122 nominale Slots gegen die CSV- und Workbookdaten abgeglichen. Die technische Prüfung des 02C-Archivs ergab erneut 100 übereinstimmende Generationen und 12.800 Datensätze. [Messdaten](../intelligence-validation/PRE-D01_EVIDENCE.json)

A bestätigte im Auftragschat den geprüften Stand von PR #7 und die Übernahme des administrativen SYS-03-Abschlusses. PR #7 wurde als `e6a95a92b6241a750ba7fff599ff2dac123c3149` gemergt. Die [CI auf main](https://github.com/Andreas-Hartweger/ARENA/actions/runs/46073023305) sowie lokal `npm ci`, `npm run check` (233 Tests) und `npm run calibrate` bestanden. Die Kalibrierwerte stimmen mit der 02B-Referenz überein.

Die 122 Experimentdefinitionen, das Budgetledger, vier historische Modellrollen und der reale Wiederanlauf sind geprüft. 14 Worker erzielten im gepaarten Vergleich den höchsten Median von 19.638 Fahrzeugticks/s. Seed 42 wurde aus den verifizierten Originaldaten übernommen. Seed 43 ist nach 100 Generationen vollständig auditiert. Die weitere Forschung läuft mit eingefrorenen Szenarien. [Forschungsstand](../intelligence-validation/RESEARCH_EXECUTION.md) · [158 Abnahmepunkte](../intelligence-validation/ACCEPTANCE_RESULTS.csv)

Alle sechs Baselines sind ausgewertet. 64.000 reguläre Episoden wurden neu gefahren, 12.800 stammen aus der verifizierten historischen Referenz. Die Entwicklungsfälle ergaben maximal 21/40 Erfolge bei Seed 44, drei schwere Kontakte traten in dessen Fehlfahrten auf. Das Screening startete auf `160db2c` mit S01-42. Die finale Validierung ist offen. [Baselines](../intelligence-validation/evidence/baselines.json) · [Entwicklungsfälle](../intelligence-validation/evidence/baseline-development.json)

Auf `4b01fac` wurden die Worker-Messung und das CPU-Profil in einer isolierten Prüfdatenbank je zweimal aus den ursprünglichen Messbelegen gelesen. Beide Ausgabedateien stimmten bytegenau mit den archivierten Berichten überein. Die Wiederverwendung verbrauchte null zusätzliche Fahrzeugticks. Der Regressionstest erzeugte außerdem vier neue Panels in einem temporären Verzeichnis, prüfte denselben Freeze beim zweiten Aufruf und erkannte eine beschädigte Entwicklungsdatei. Alle 247 Tests und die CI bestanden. [CI](https://github.com/Andreas-Hartweger/ARENA/actions/runs/46095208324) · [Regressionstest](../../scripts/research/check-evidence.mjs)

Am 28.11.2026 um 11:09 Uhr MEZ hat das Ledger den ersten 12-Stunden-Bericht versiegelt. 35 Varianten waren auf beiden Seeds abgeschlossen. Die Rechnung stimmte mit den ersten 1.324.636 Ereignissen und der unabhängigen Dateikopie auf diesem Rechner überein. [Maschinenlesbarer Stundenbericht](../intelligence-validation/evidence/budget-12h.json)
