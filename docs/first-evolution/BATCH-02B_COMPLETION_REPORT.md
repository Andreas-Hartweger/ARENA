# Abschlussbericht · First Evolution · Batch 02B

**Abnahme vom 27.11.2026.** A hat die ausstehenden Prüfschritte delegiert und den Merge nach erfolgreicher Prüfung ausdrücklich freigegeben. Das Review des von B übergebenen Stands ist abgeschlossen. PR #6 wurde als `c74ab27daf3159329d9049076ab3c30c5a4759ea` in `main` übernommen. Die CI auf diesem Commit ist grün. Die folgende Übergabe dokumentiert den Stand vor der Freigabe. [Review und Merge](https://github.com/Andreas-Hartweger/ARENA/pull/6) · [CI auf main](https://github.com/Andreas-Hartweger/ARENA/actions/runs/46009031010)

B übergibt den Implementierungsstand von PRE-B01 und EV-001–013 an A und B. Die technische Prüfreihe für den Referenzlauf ist abgeschlossen. 12.800 von 12.800 regulären Auswertungen lieferten einen gültigen Score. Die erste gültige Runde wurde in G31 abgeschlossen. Die schnellste gültige Runde dauerte 59,664 simulierte Sekunden. Das unabhängige 02B-Review und die ausdrückliche Freigabe zum Merge stehen aus. [PR #6](https://github.com/Andreas-Hartweger/ARENA/pull/6) · [Aktuelle CI](https://github.com/Andreas-Hartweger/ARENA/pull/6/checks) · [Abnahmematrix](ACCEPTANCE_RESULTS.md)

## Grundlage und Prüfumgebung

Am 27.11.2026 bestätigte der Auftraggeber die gemeinsame Abnahme von Batch 02A durch A und B. PRE-B01 lief auf dem sauberen Stand `61cd54a2be454915647b9089bc6da5c5d1bc16d8`. Gegenüber der erwarteten Basis `b2af9465976c7638b391074f8e241933dfcd53c5` änderten sich ausschließlich drei 02A-Dokumente. Die 21 ZIP-Einträge stimmen mit ihren Git-Blobs überein. Der Masterplan v0.9 und der Katalog wurden auf alle 103 Entscheidungs- und 128 Prüfpunkt-IDs abgeglichen. [PRE-B01](../team/DEVELOPMENT_PROGRESS.md) · [Paketvergleich mit Hashes](evidence/package-verification.json)

Windows 11 Pro, Intel Core Ultra 7 255H, 16 logische CPUs, 31,5 GiB RAM, Node v24.22.3, npm 11.19.1. Der Referenzprozess rechnete seriell auf der CPU. Leistungsprofil und Hintergrundlast waren unkontrolliert. Lokale Prüfungen und getrennte Benchmarkprozesse liefen zeitweise gleichzeitig. Quellstände und Rohmessungen begleiten jeden Lauf. [Referenzkonfiguration](evidence/reference-release/run.json)

## Prüfergebnisse

- PRE-B01 bestand nach `npm ci` den vollständigen Check mit **160/160 Tests in 23 Dateien**. Der Check auf dem Feature-Branch bestand TypeScript einschließlich Headless-Kern, ESLint, Prettier, **213/213 Tests in 29 Dateien** und den Produktionsbuild. Vite meldete für das JavaScript-Bundle 839,24 kB gegenüber 838,03 kB in der Baseline. Die Warnschwelle beträgt 500 kB. Auf GitHub überschritt ein Test mit zwei vollständigen Fahrten die voreingestellten fünf Sekunden. Für diesen Test setzt 8f0d57e ein Zeitbudget von 30 Sekunden. Alle fachlichen Assertions und simulierten Fristen sind identisch. [Erster CI-Fehler](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45977421191) · [Wiederholung nach Korrektur](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45977786312). [Tatsächliche Testfälle und Einzelstatus](evidence/tests.json)
- Die Fahrphysik erreichte wie in PRE-B01 0–100 km/h in 229 Ticks, eine Spitze von 248,341174 km/h, 31,174882 m Bremsweg in 137 Ticks und rückwärts 29,675641 km/h. Der gesonderte Framevergleich prüfte sämtliche 1.200 menschlichen Frames einschließlich HUD-Ereignissen sowie sämtliche 600 KI-Frames je Frequenz und Trace-Modus. Die jeweiligen Hashes stimmten für 02A, 02B ohne Feed und 02B mit Feed überein. [Kalibrierung](evidence/calibration.json) · [Vollständige Framefolgen](evidence/world-parity.json)
- Im Browser wurden menschliche Fahrt, Wechsel auf den vorhandenen Seed-42-Fahrer, die 248-Kanal-Inspektion, Kamerawechsel, Pause und Einzelschritt 798→799 geprüft. Es gab dabei keine Konsolenfehler oder -warnungen. Im wiederholten Vergleich mit Node durchlief auch der Browser exakt 600 KI-Ticks. Die größte absolute Differenz der Fitnesskomponenten betrug 1,64 × 10⁻¹³ (aufgerundet), die der mutierten Parameter 6,94 × 10⁻¹⁸. [Bedienprotokoll](evidence/browser.json) · [Laufzeitvergleich](evidence/runtime-release.json)
- Die Randfälle umfassen nach rückwärts korrigierte Kontaktpositionen, leichte Solverkontakte, Rollback, ungültig gewordene Runden, Budgetgrenzen und fehlgeschlagene Transaktionen. Ein fest konstruiertes Test-Brain überfuhr auf einer separaten Teststrecke das Ziel. Die unabhängig interpolierte Torzeit entschied auch am letzten erlaubten Tick richtig. Die statistischen Prüfungen nutzen feste Seeds und analytische Grenzen. [Abnahmematrix](ACCEPTANCE_RESULTS.md)

## Referenzlauf mit Seed 42

Balanced, frische GT-01-Einzelfahrten auf Academy mit vorhandener Sensorik und Brain 248–32–16–3. Je Episode maximal 120 simulierte Sekunden, 5 Sekunden Schonfrist, anschließend 15 Sekunden für 2 neue gültige Meter. Je Folgegeneration sechs erneut ausgewertete Eliten und 122 mutierte Kinder. Elternpool 100 %, Turniergröße 3, Kreuzung 0 %, p = 0,05, α = 0,2, große Schritte mit Wahrscheinlichkeit 0,05 und Faktor 5, Grenzen ±8 und ±4. Adaption, Immigrants und Rettung waren deaktiviert. Ausgangsgewichte stammen aus der vorhandenen unabhängigen Brain-Initialisierung.

| Generation | Beste Fitness | Mittel   | Median | Größter Fortschritt inkl. Anfahrt (m) | Gültige Runden | Verschiedene Genome |
| ---------- | ------------- | -------- | ------ | ------------------------------------- | -------------- | ------------------- |
| 0          | 167,18        | 14,99    | 0,00   | 118,83                                | 0              | 128                 |
| 24         | 776,78        | 204,34   | 176,22 | 530,31                                | 0              | 128                 |
| 31         | 4.269,33      | 246,22   | 165,59 | 667,91                                | 1              | 128                 |
| 49         | 4.275,77      | 427,56   | 168,98 | 667,91                                | 7              | 128                 |
| 74         | 4.275,90      | 521,71   | 220,78 | 667,91                                | 9              | 128                 |
| 99         | 4.280,19      | 1.152,05 | 523,59 | 667,91                                | 25             | 128                 |

G0–G99 ergaben 30.575.844 simulierte Fahrzeugticks und 141,55 simulierte Stunden. Die aktive Generationslaufzeit betrug 80,90 Minuten, die Summe der je Generation gemessenen Prozess-CPU-Zeit 80,98 Minuten. Das entspricht 2,64 Episoden/s und 6.299 Fahrzeugticks/s. Der größte unmittelbar nach einer Generation gemessene RSS betrug 464,0 MB. Es gab 12.076 × `noProgress`, 60 × `timeout`, 664 × `completed`. Der Lauf erreichte insgesamt 664 gültige Runden. Weitere Trainingsseeds und unabhängige Validierungsfahrten sind Gegenstand von D14.

Der separate Prüfer rechnete die Scores, Strafen und Quantile aus den Einzelrecords nach und prüfte Sortierung, Mutation, Abstammung, Champion und alle 594 Elite-Neuauswertungen. Die Kandidatenbytes der ersten 77 Generationen stimmen mit dem gesicherten Stand vor der Unterbrechung überein. Für die ersten 35 Generationen liegen zusätzlich bytegleiche unabhängig gefahrene Resultate vor. Der Datensatz umfasst ausschließlich G0–G99. Champion-Genomhash `5ea750f9d24cb861b2a901f9e325dd0b79f0b4a8f45c94a2202829ae4eb21c95`. [Audit](evidence/reference-audit.json) · [Kandidatendaten als NDJSON/Gzip](evidence/reference-release/episodes.ndjson.gz) · [Generationsdaten](evidence/reference-release/generations.ndjson) · [Laufende](evidence/reference-release/end.json)

Der Referenzlauf auf `44c100c` wurde nach G76 unterbrochen. Die 9.856 Einzelrecords aus G0–G76 waren vollständig gespeichert. Aus ihnen wurden dieselben Genome und Abstammungen für G77 rekonstruiert. Anschließend fuhren auf demselben Quellstand ausschließlich die fehlenden 2.944 Kandidaten aus G77–G99. Der Endabgleich auf `c3d11b3` reproduzierte alle 100 Generationen aus ihren gespeicherten Ergebnissen und simulierte dabei null Fahrten. [Gesicherter Zwischenstand](evidence/interrupted-reference.json) · [77 Vergleichshashes](evidence/interrupted-prefix.json) · [Fortsetzungsprotokoll](evidence/reference-release/continuation.json) · [Endabgleich](evidence/generation-replay.json)

Vor dieser Fortsetzung startete B versehentlich einen weiteren Lauf auf `5297f65` und stoppte ihn nach G34. Seine 4.480 Fahrten stimmen bytegenau mit den entsprechenden Ergebnissen des Referenzlaufs überein und sind vom Budget der 12.800 Fahrten ausgeschlossen. Bereits während der Entwicklung wurde ein Lauf auf `fbce904` nach 13 Generationen verworfen, weil rückwärtige Kontaktkorrekturen Fortschritt mehrfach gutschreiben konnten. Nach der Korrektur wurden 22 Generationen separat verglichen. [Vergleich des versehentlichen Neustarts](evidence/repeat-comparison.json) · [Verworfener Entwicklungsstand](evidence/superseded-run.json) · [Vergleich nach der Korrektur](evidence/comparison-prefix.json)

## Zwei tatsächliche Fahrlinien

Der beste Fahrer aus G0 und der erste Rundensieger aus G31 wurden zur Ansicht aus Seed und Abstammung rekonstruiert. Beide fuhren mit Positionsaufzeichnung erneut. Jeweils alle Bewertungswerte stimmten mit dem Ursprungslauf überein. Das Bild zeigt 2.091 bzw. 5.888 echte Physikticks und die Startpositionen. Der kompakte Hauptlauf speichert die Zahlen pro Fahrt und Generation. Die vollständige Positionsfolge liegt für diese beiden ausgewählten Fahrten vor. [Zeitraffer](evidence/academy-first-lap.gif) · [Standbild](evidence/academy-first-lap.png) · [Koordinaten mit 60 Hz](evidence/academy-lines.json.gz)

## Gleich budgetierte Kurzläufe

Bei jeweils 8 Kandidaten × 4 Generationen hatte die gemeinsame G0 ein Maximum von 137,235216 und einen Mittelwert von 34,796002. Selektion endete bei 189,066372 / 110,399667 (Maximum / Mittel in G3), Zufallssuche bei 149,091186 / 51,331613. Deren höchster Einzelwert war 183,738085 in G2. Die Laufzeiten betrugen 14,44 bzw. 13,70 Sekunden. Alle 32 Kandidatenrecords des Selektionslaufs waren bei seiner Wiederholung bytegleich. Beide Kurzläufe erzielten null gültige Runden. Der Vergleich gilt für diesen Seed und dieses Budget. [Selektion](evidence/short-evolution/generations.ndjson) · [Zufallssuche](evidence/short-random/generations.ndjson) · [Wiederholung](evidence/short-repeat.json)

## Benchmarks

Die Rohdaten enthalten 207 Messfenster über mindestens fünf Sekunden. Jede Kombination wurde dreimal wiederholt. Warmup mindestens 600 Fahrzeugticks oder 1.000 Komponentenoperationen. Angegeben sind Mediane, das empirische p95 ist bei drei Werten der höchste Rang. CPU-Zeiten, RSS, Heap, Min/Max/p95 sowie Warmup stehen je Zeile in den Rohdaten. [Kontrollrechnung](evidence/benchmark-audit.json)

### Gepaartes DriveWorld-Replay in Fahrzeugticks/s

| Sensor/Brain Hz | Trace | 02A   | 02B Feed aus | 02B Feed an | An ggü. 02A | An ggü. Aus |
| --------------- | ----- | ----- | ------------ | ----------- | ----------- | ----------- |
| 30/30           | aus   | 5.672 | 6.291        | 6.226       | 9,8 %       | -1,0 %      |
| 30/30           | an    | 5.895 | 6.187        | 6.089       | 3,3 %       | -1,6 %      |
| 60/60           | aus   | 2.565 | 3.152        | 3.127       | 21,9 %      | -0,8 %      |
| 60/60           | an    | 3.131 | 3.100        | 3.088       | -1,4 %      | -0,4 %      |

In keiner der vier Paarungen überschritt der mediane Durchsatzverlust mit Feed den Untersuchungsmarker von 15 %. Die Reihenfolge der Messreihen blieb fest. Der RSS nach dem ersten 30/30-Messblock lag im Median bei 259,3 MB (02A) und 297,4 MB (02B mit Feed). Da die Varianten im selben Prozess nacheinander liefen, lässt sich aus diesen Werten kein isolierter Mehrbedarf des Feeds ableiten. Die separate Retentionsmessung zählt zusätzlich tatsächlich erreichbare Objekte. [Welt-Rohdaten](evidence/benchmark-world.json)

### Vollständige Einzelepisode mit identischem Modell

| Sensor/Brain Hz | Trace | Ticks | Fitness   | Episoden/s | Fahrzeugticks/s | sim. s / reale s |
| --------------- | ----- | ----- | --------- | ---------- | --------------- | ---------------- |
| 30/30           | aus   | 1.246 | 64,214311 | 6,77       | 8.432           | 140,53           |
| 30/30           | an    | 1.246 | 64,214311 | 6,75       | 8.416           | 140,27           |
| 60/60           | aus   | 1.265 | 76,387604 | 3,43       | 4.336           | 72,27            |
| 60/60           | an    | 1.265 | 76,387604 | 3,41       | 4.318           | 71,97            |

### Komponenten

| Operation                                  | Median    | Einheit           |
| ------------------------------------------ | --------- | ----------------- |
| Fitness, Fortschritt und Strafen gemeinsam | 589,49    | ns/Tick           |
| Box-Muller inkl. Zufallsquelle             | 43,04     | ns/Wert           |
| Mutation, 8.547 Parameter                  | 7.572,66  | Genome/s          |
| Mutation mit 64 Trace-Einträgen            | 9.625,18  | Genome/s          |
| Uniform Crossover                          | 7.973,63  | Genome/s          |
| Neuronweiser Crossover                     | 63.064,91 | Genome/s          |
| Kanonischer SHA-256                        | 15.072,27 | Genome/s          |
| Ranking und 128 Turniere                   | 0,03      | ms/Generation     |
| Diversity für 128 Standardgenome           | 5,03      | ms/Generation     |
| Diversity für 1.024 Standardgenome         | 48,56     | ms/Generation     |
| Stagnationsdiagnose ohne Adaption          | 23,45     | ns/Aktualisierung |
| Stagnationsdiagnose mit Adaption           | 29,05     | ns/Aktualisierung |

Die Rohmatrix enthält alle vier Modellgrößen je Genomoperation, alle fünf Populationsgrößen für Selektion und Diversity und beide Adaptionsmodi. Die zeitgemessenen Rückgabewerte gehen in eine Prüfsumme ein, damit die Laufzeitumgebung die reine Berechnung nicht als ungenutzt wegoptimiert. [Komponenten-Rohdaten](evidence/benchmark-components-verified.json)

### Skalierung ganzer Generationen

Median in Sekunden einschließlich echter World-Episoden, Selektion, Mutation und Erzeugung der Folgepopulation. Die Größenmatrix verwendet Sechs-Tick-Aufgaben. 81.795 Parameter wurden mit dem vorgesehenen Teilset von 8 und 32 Kandidaten gemessen.

| Parameter | n = 8 | n = 32 | n = 128 | n = 512 | n = 1.024 |
| --------- | ----- | ------ | ------- | ------- | --------- |
| 4.147     | 0,048 | 0,184  | 0,590   | 2,340   | 5,154     |
| 8.547     | 0,041 | 0,187  | 0,632   | 2,503   | 5,470     |
| 18.115    | 0,044 | 0,173  | 0,700   | 3,223   | 5,552     |
| 81.795    | 0,073 | 0,426  | Teilset | Teilset | Teilset   |

Der Prozess erreichte während der Größenmatrix einen RSS-Höchstwert von 685,8 MB. Der selektive Trace bei 128 Kandidaten änderte den Durchsatz um -1,04 %. Die Scores aller Kandidaten und die nachfolgende Population ergaben in beiden Varianten denselben Prüfdigest. [Skalierungs- und Trace-Rohdaten](evidence/benchmark-scale.json)

### Speicher über 200 kleine Generationen

Jeweils drei Wiederholungen mit acht Kandidaten und acht echten Ticks pro Aufgabe. In der gesonderten Retentionsmessung waren nach G0 und G99 jeweils acht verschiedene Genome und null Welten vom veröffentlichten Zustand erreichbar. Nach G199 waren es ein Champion-Genom, null Welten und 1.600 kompakte Einzelrecords. Nach expliziter Garbage Collection lagen die finalen Heap-Werte bei 13,25–13,43 MB. Der finale RSS lag zwischen 323,8 und 348,7 MB. Die Objektzählung untersucht den veröffentlichten Zustand. Die Prozesswerte umfassen zusätzlich V8, Bibliotheken und zuvor reservierten Speicher. [Dauerlauf](evidence/benchmark-endurance.json) · [Objektzählung und GC-Stichproben](evidence/retention.json)

## Übergabe und offene Punkte

- Die Implementierung verwendet den vorhandenen Solver, Rundenprüfer, DriveWorld, Brain, AI Driver und SeededRandom. Der optionale Bewertungsfeed veröffentlicht nur akzeptierte Bewegungen, Kontakte und Tore zusammen mit dem WorldFrame. Der normale Fahrmodus startet ohne Feed. [Architektur und Wiederholung](README.md)
- Für FIT-001 hat der Auftraggeber die Entscheidung delegiert. B begrenzt Aufgaben auf 1–1.000.000 Runden. Dadurch bleibt jede zusätzliche Runde auch beim ungünstigsten Detailwert im numerischen Float64-Score unterscheidbar. Die Standardaufgabe hat eine Runde. [DR-02B-001 mit Reproduktion und Alternativen](../team/DECISION_REQUESTS.md)
- Grenzen der Aussagekraft sind der einzelne Standardseed, die Sättigung einzelner Strafterme und die diskrete Körperzustandsnäherung im interpolierten Zieltick. Erfolg und Generalisierung über Seeds, Strecken und Holdouts gehören zur gesonderten D14-Planung.
- Alle 103 Entscheidungen sind auf die 128 Abnahmepunkte abgebildet. REL-003 bleibt für A und B offen. Der Branch `feature/batch-02b-ai-evolution` steht im gemeinsamen PR nach `main` zum Review. Training-UI, Persistenz, Worker und D14 benötigen einen neuen Auftrag. [Abnahmematrix](ACCEPTANCE_RESULTS.md) · [Teamübergabe](../team/HANDOVER_CURRENT.md)

**NÄCHSTER PLANUNGSAUFTRAG ERFORDERLICH.**
