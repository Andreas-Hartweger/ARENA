# Batch 02A · Technischer Abschluss und Entwicklerreview

## A · Stand

Ausgangsbasis ist First Drive 0.2.0-rc.1 auf `68e8d1051a5ea01d544cc1496917568c25b59b92`. Die Feature-Branch heißt `feature/batch-02a-ai-perception-brain`. Der geprüfte Implementierungsstand einschließlich Benchmarkprogramm ist `b1995a38742e45d7565c8485d241239ace90acfa`. Der anschließende Nachweiscommit ergänzt Dokumentation, Messdaten und einen weiteren Geometrietest. Der aktuelle Remote-Stand und seine CI sind im [gemeinsamen PR #5](https://github.com/Andreas-Hartweger/ARENA/pull/5) einsehbar. Die Ausgangsbasis wurde mit [PR #4](https://github.com/Andreas-Hartweger/ARENA/pull/4) und [main-CI](https://github.com/Andreas-Hartweger/ARENA/actions/runs/45613045498) abgeglichen.

## B · Übernahme und Abnahme

PRE-001/002 bestanden. Die lokale Baseline bestand 134 Tests in 18 Dateien und reproduzierte die fünf Kalibrierwerte. Entwickler B meldete die native Alt+Tab-Prüfung als erfolgreich. Auf die anschließende ausdrückliche Frage nach dem gemeinsamen Review, D00/G07 und Batch-Freigabe bestätigte der Auftraggeber die Abnahme durch A und B. Evidenz für die menschlichen Entscheidungen ist die Rückmeldung im [Übergabelog](../team/HANDOVER_LOG.md). Es liegen keine getrennten maschinellen Mitschnitte beider Rechner vor. PRE-003 ist mit Handover 002 und den Teamdateien umgesetzt. Separate frühere Entwürfe standen laut Nutzer auch auf Nachfrage nicht zur Verfügung.

## C · First-Drive-HUD

PRE-004/005 bestanden. Chrome zeigte nach Recovery in Tick 2 den Hinweis noch in Tick 181, auch während der Pause. In Tick 182 war er verschwunden. Eine erneute Aktion verlängerte die Frist. Die Achswerte im Stand betrugen je 0 % Auslastung bei 7971 N auf Asphalt. Auf Gras waren je 2869 N verfügbar. Unmittelbar beim Reset fehlen die letzten Physikdiagnosen und die Kraftanzeige zeigt einen Strich. Das Fahrgefühl „war nicht schön“ bleibt als qualitative Rückmeldung für eine spätere Planung erhalten. [Tickprotokoll](evidence/human-replay.json) · [Fahrprobe im Browser](evidence/browser-drive.json)

## D · Arbeitspakete und Testnachweise

Die Testdateien sind unter `tests/ai` im Repository zu finden. Die folgenden Gruppen beziehen sich auf die einzelnen Fälle des [Testkatalogs](BATCH-02A_TESTS.md).

| Paket      | Umsetzung                                                                                            | Geprüfte IDs und Evidenz                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| FI-001     | Validiertes und kopiertes GT-01-Profil, lokale Sensorursprünge und Takte                             | SEN-001–003 · perception.test.ts                                                    |
| FI-002     | Analytische Fahrbahnränder, Wall-Polygone, OBB, statischer Suchbaum und vollständiger Vergleichspfad | SEN-004–012 · perception.test.ts, visibility.test.ts, controls.test.ts              |
| FI-003     | Sichtbare Tangente, durchgehend geprüfte Vorschau und getrennte Gültigkeit                           | SEN-013–019 · perception.test.ts, visibility.test.ts                                |
| FI-004     | Kanalregister, Achsprobe, vier geordnete Slots, Masken und Kompatibilitätsprüfung                    | SEN-020–022, OBS-001–005 · perception.test.ts, visibility.test.ts, controls.test.ts |
| FI-005/006 | Dense-Netz, drei Aktivierungen, lineare Ausgabe, Seed und geschützter Parametervektor                | NN-001–007 · network.test.ts, world.test.ts                                         |
| FI-007     | Tanh-Adapter, gemeinsame Zielaufbereitung und 60-Hz-Richtungsgate                                    | CTL-001–005 · network.test.ts, controls.test.ts und bestehende Input-Regression     |
| FI-008     | Individuelle Takte und Caches, gemeinsame Welttransaktion, Reset und Sperre bei Fehler               | INT-001–006 · world.test.ts, controls.test.ts und Browsernachweise                  |
| FI-009/010 | Messframe, sichtbare Strahlen, Kanalwahl, Schicht-/Neuron-/Verbindungswahl, Pause und Einzeltick     | INS-001–004 · world.test.ts und Browsernachweise                                    |
| FI-011     | Regression, Kalibrierung und Messmatrix                                                              | REG-001/002, BEN-001–004 · Abschnitte H bis J                                       |
| FI-012     | Bericht, Teamübergabe, Remote-Branch, PR und CI                                                      | REL-001 · PR #5; menschliches Review ausstehend                                     |

## E · Eingaben und Gewichte

Das erzeugte Register wurde zeilenweise mit allen 248 CSV-Zeilen verglichen, einschließlich Einheit, Grenzen und Masken. Es besteht aus 12 Ego-, 144 Strahl-, 4 Orientierungs-, 56 Vorschau- und 32 Objektkanälen. Die Inferenz erhält normierte Werte. Fehlende Gruppen ergeben Nullwerte mit gelöschten Masken. Jede Instanz liest Achsmaterial und Reibwert aus derselben reinen Achsprobe wie der nächste Physiktick. Die Modellkompatibilität vergleicht die kanonische vollständige Beschreibung von Register, Geometrie, Frequenzen, Steuervertrag, Fahrzeug und Setup.

Das Standardnetz 248 → 32 → 16 → 3 besitzt 8496 Gewichte und 51 Biaswerte. Der private Float64-Vektor benötigt 68.376 Bytes. Eine ausgegebene Parameterkopie kann die Gewichte nicht verändern. Der Maximalfall mit vier versteckten Schichten zu je 128 Neuronen enthält 81.795 Parameter. Seed 0/1/42, analytisches Kleinnetz, Vorzeichen, Bias-Offsets und Überlauf werden separat geprüft.

## F · Sichtschutz

Geraden und Kreisbögen der Fahrbahngrenzen stammen aus derselben Streckendefinition wie die Materialabfrage. Der Suchbaum grenzt die in Frage kommenden Wall-Polygone ein. Beide Suchwege verwenden anschließend denselben Schnittalgorithmus. 1002 Strahlen mit Seeds 0/1/42 und beweglich platzierten Fahrzeugkörpern lieferten identische Ergebnisse. Unabhängige Fahrzeuge fehlen auch in der Verdeckung. Ein metamorpher Test verschiebt verdeckte Geometrie bzw. fügt ein verdecktes Fahrzeug ein und vergleicht den ganzen Vektor und den Netzoutput.

Die Vorschau teilt den Verlauf an Geometrieübergängen. Das Dreieck aus Auge und Sehne umschließt den Sichtfächer einer Geraden. Beim Bogen erweitert der Algorithmus es um die obere Schranke für den Sehnenfehler, |κ|·L²/8. Eine trennende Achse muss jeden möglichen Blocker ausschließen. Bei unklarem Ergebnis wird unterteilt, am Auflösungs- oder Tiefenlimit endet die Vorschau. Ein 1 mm dünnes Hindernis zwischen Vorschaupunkten unterbricht die Folge. Die Richtungs- und Krümmungsprüfung bezieht zusätzlich die sichtbare Nachbarschaft ein. Der erste lokale Anschluss unter dem eigenen Fahrzeug darf innerhalb der nachgewiesenen Fahrzeugkontur liegen. Auch dort gelten die Verdeckungsprüfungen. Alle ausgegebenen Punkte liegen im vorderen Halbraum und höchstens 150 m vom Auge entfernt.

## G · Takt, Fehler und Wiederholbarkeit

Alle Fahrer lesen denselben letzten veröffentlichten Zustand. Beobachtungen, Zielbefehle und Diagnosen werden mit dem Physik- und Kontaktresultat gemeinsam veröffentlicht. Beim erzwungenen Überlauf im zweiten Fahrer blieb das gesamte bisherige Frame-Objekt identisch. Weitere Schritte waren gesperrt. Akzeptierte Recovery leert die Fahrer-Caches. Die nächste Messung und Entscheidung sind auch außerhalb des regulären Takts frisch. Abgewiesene Recovery bewahrt die Caches gemäß Taktplan.

Nach 240 Ticks stimmten die geprüften Simulationszustände bei 30, 60 und 144 Render-Hz im selben Runtime exakt mit Headless überein. Der separate Vergleich zwischen Node und Chrome erfasste 257 Zahlen einschließlich Beobachtungsvektor und Output. Die maximale absolute Differenz betrug 1,78·10⁻¹⁵. [Runtime-Vergleich](evidence/runtime.json)

## H · Browser und Inspector

Chrome 158.0.8127.89 mit WebGL über SwiftShader und DPR 1. Geprüft wurden 1280 × 850 und 390 × 844 CSS-Pixel, Fokus, Fahrerwechsel zum Menschen, alle Kameras, Gras und Barriere, Recovery, Grafikfehler und fehlender WebGL-2-Kontext. Die automatisierte Fahrt reproduzierte eine gültige Runde in 1:05,93. Der persönliche Fahrtest und Alt+Tab stammen aus der gesonderten menschlichen Abnahme. Der Test des Geräteverlusts und der absichtlich fehlerhafte Modelloutput liefen in isolierten Browsersitzungen.

Im pausierten Bias-Fixture stimmten Eingang, Summe, Aktivierung und Zielgas mit dem mathematischen Modell überein. Einzeltick erhöhte den veröffentlichten Stand exakt um eins. Bei 390 px wurde kein horizontaler Seitenüberlauf gemessen. [Messwerte](evidence/browser.json) · [Sensor Inspector](evidence/inspector-desktop.png) · [Brain Inspector](evidence/brain-desktop.png) · [Mobilansicht](evidence/inspector-mobile.png) · [KI-Fehlerfall](evidence/ai-error.png)

## I · Benchmarks

Die [Rohmessungen](evidence/benchmark.json) enthalten pro Fall Warmup, Aufrufzahlen, fünf Messfenster, Laufzeit, Minimum, Median und p95 der Zeit pro Aufruf sowie RAM vor und nach der Messung. `node scripts/benchmark-ai.mjs` führt die Matrix aus. Laufzeit ist Node 24 auf Windows, Seed 42. Die GPU des Rechners ist eine Intel Arc 140T. Die Kernmessungen laufen auf der CPU. Weltmessungen unterscheiden Welt- und Fahrzeugticks und nennen die aggregierten simulierten Sekunden pro Echtzeitsekunde. Der Trace-Vergleich im Browser ist eine kurze Stichprobe mit Software-Rendering. Eine einzelne FPS-Zahl erlaubt keine belastbare Aussage zum Mehraufwand.

Auf dem Intel Core Ultra 7 255H mit rund 31,5 GiB RAM erreichte der Raycast auf Academy ohne Gegner 18.055 Strahlen/s bei vollständiger Suche und 122.451 Strahlen/s mit Suchbaum. Mit einem weiteren Fahrzeug waren es 16.822 bzw. 124.849 Strahlen/s. Das Standard-MLP erreichte mit einer Instanz 167.237 Auswertungen/s. Bei 100 isolierten Fahrzeugen betrug der aggregierte Durchsatz bei 30/30 Hz rund 6305 Fahrzeugticks/s, bei 60/60 Hz rund 1684. Ein Fahrer bei 30/30 Hz erreichte ohne Trace 8653 und mit Trace 8601 Ticks/s. Diese Werte sind Mediane aus fünf Messfenstern von jeweils mindestens einer Sekunde. Das Warmup umfasste mindestens 1000 isolierte Aufrufe bzw. 600 aggregierte Fahrzeugticks. Die Welt lief zwischen den Fenstern fort. Eine Messung mit zwei gemeinsamen Fahrzeugen ist separat enthalten.

Drei Wechsel Mensch → Seed-Modell → Mensch ließen die Zahl der beobachteten Eingabe-/Fokus-/Canvas-Listener und die Zahl ausstehender RAF-Callbacks unverändert. [Lifecycle-Protokoll](evidence/lifecycle.json)

## J · Qualitätsschleife

`npm run check` bestand mit beiden Typprüfungen, ESLint, Prettier, allen 154 Tests in 23 Dateien und Produktionsbuild. Alle 134 bestehenden Tests blieben erhalten. Vite meldete für das minifizierte Hauptbundle rund 836 kB und eine Warnung oberhalb von 500 kB. `npm run calibrate` reproduzierte die Referenzwerte:

| Messgröße            |     First Drive |       Batch 02A |
| -------------------- | --------------: | --------------: |
| 0–100 km/h           |      3,816667 s |      3,816667 s |
| Spitze               | 248,341174 km/h | 248,341174 km/h |
| Bremsweg ab 100 km/h |     31,174882 m |     31,174882 m |
| Bremsdauer           |      2,283333 s |      2,283333 s |
| Rückwärtsspitze      |  29,675641 km/h |  29,675641 km/h |

## Technische Nachprüfung nach Übergabe von PR #5

Auf `f5071de` ließ sich ein fehlender Asphalt-/Grasübergang auf Academy reproduzieren. Bei sehr flachem Schnitt lagen die beidseitigen Proben innerhalb der numerischen Toleranz der Materialabfrage. Die Probe nutzt nun den freien Abstand zu benachbarten Schnittpunkten, Reichweite und Verdeckung. Eine feste Probe unmittelbar am Schnitt entfällt. Ein unabhängig berechneter Vergleich auf der oberen Academy-Geraden deckte 11.909 Strahlen aus vier Seeds ab. Materialklasse und Treffer stimmten durchgehend. Die größte absolute Distanzabweichung lag unter 6,7·10⁻⁹ m. [Geometrieprüfung](evidence/road-edge-review.json)

Drei weitere zunächst fehlschlagende Regressionen betrafen JS-Arrays mit unbelegten Einträgen bei Netzarchitektur, Eingabe und Ausgabe. Hinzu kam ein Test für widersprüchliche Strahlmessungen. Der Kern weist solche Daten an der jeweiligen Schnittstelle ab. Ein zusätzlicher analytischer Test unterscheidet an allen vier Academy-Innenbögen die exakte Tangente von einem echten, sehr schmalen Durchgang durch Gras. Nach der Nachprüfung bestehen 160 Tests in 23 Dateien. Kalibrierung und Build bestanden. Die Vite-Warnung zur Bundlegröße besteht fort. In einem frischen Windows-Export von `efb62ef` installierte `npm ci` die 194 im Lockfile aufgelösten Pakete. Auch dort bestanden `npm run check` und `npm run calibrate`.

Die festen Fahrbahngrenzen werden für den indizierten Pfad beim Aufbau der Geometrie vorbereitet. Der Referenzpfad baut sie pro Abfrage aus der TrackDefinition auf. Alle 8192 zusätzlichen Strahlen ergaben vor und nach der Umstellung identische Resultate. In zwölf abwechselnd ausgeführten Vergleichspaaren sank die Medianzeit für diese Strahlen von 89,27 auf 78,90 ms. [Gepaarte Vergleichsmessung](evidence/geometry-review.json) · [Erneute Benchmarkmatrix](evidence/benchmark-review.json)

In 4096 zusätzlichen Streckenszenen prüfte eine separate konvexe Segment-Clipping-Rechnung 386.506 Sichtlinien zu akzeptierten Vorschauintervallen in Abständen von 0,5 m. Von 28.672 abgefragten Vorschaupunkten waren 13.126 gültig. Keine geprüfte Sichtlinie schnitt einen Blocker. 2048 Szenen enthielten ein Fahrzeug oder einen nur 1 mm dünnen Sichtschirm. Diese Stichproben ergänzen den kontinuierlichen geometrischen Nachweis im Algorithmus. [Sichtprüfung](evidence/preview-review.json)

Zwei Fahrer wurden in gemeinsamen und getrennten Welten jeweils 108.000 Ticks mit identischen Kontrollläufen verglichen. In einem Lauf wechselte die Diagnose regelmäßig, im anderen blieb sie geschlossen. Position und angewandter Befehl wurden in jedem Tick verglichen, kompletter Fahrzeugzustand, Runde und Beobachtung zusätzlich jede simulierte Sekunde und am Ende. Es gab keine Abweichung. In allen vier Welten zusammen entspricht das 864.000 Fahrzeugticks. Reproduzierbar mit `node scripts/verify-ai-endurance.mjs`. Beim zusätzlichen Vergleich Node gegen Chrome mit drei Seeds und je 3600 Ticks stimmten alle geprüften Gültigkeitsbits überein. Der größte Unterschied einer Positionskomponente betrug 2,85·10⁻¹⁴ m. [Dauerlauf](evidence/endurance.json) · [Runtime-Matrix](evidence/runtime-review.json)

Im Testmodus öffnet der Fahrerwechsel die Diagnose direkt. Die 248 Kanäle sind nach den fünf Schema-Gruppen auswählbar. Eine Tabelle zeigt die angeforderten und angewandten Pedal-, Lenk- und Richtungswerte mit zugehörigem Tick. Beide Modelle wurden bei 390, 768 und 1280 CSS-Pixeln jeweils pausiert und fünfmal einzeln weitergeschaltet. Die sechs Durchläufe ergaben genau 30 Einzelschritte, ohne Seitenüberlauf oder JavaScript-Fehler. [Browserprüfung](evidence/inspector-review.json) · [Ansicht der Fahrbefehle](evidence/commands-review.png)

Eine unabhängige Python-Rechnung mit `math.fsum` und `math.tanh` verglich sämtliche gewichteten Summen, Aktivierungen und Ausgaben von 36 Netzen bei je acht Eingabevektoren. Geprüft wurden vier Architekturen, drei Aktivierungsfunktionen und drei Seeds. Die größte absolute Differenz betrug 1,60·10⁻¹⁴. [Numerischer Referenzvergleich](evidence/network-reference.json)

Die nicht trainierten Modelle kennzeichnen die Initialisierung in ihren Metadaten. Der Inspector zeigt beim mathematischen Fixture „Vorgegebene Gewichte“ und beim Seed-Modell den tatsächlichen Seed. Die Bedienfolge steht in der [Projekt-README](../../README.md#ki-testfahrt-und-inspector).

Bei einem weiteren Browserlauf meldete WebGL den nativen Renderer Intel Arc 140T über Direct3D 11. In je rund 30 Sekunden wurden 1799 Ticks bei 1280 × 800 mit geschlossenem Inspector und 1802 Ticks bei 1920 × 1080 mit offenem Inspector beobachtet. Es traten keine JavaScript-Fehler auf. [Prüfung mit Hardwarebeschleunigung](evidence/browser-renderer.json)

Im direkten Vergleich zwischen der First-Drive-Basis und `efb62ef` stimmten alle 36.000 vollständigen veröffentlichten Weltframes exakt überein. Drei Seeds steuerten je zwei Fahrzeuge mit Tastatur- und Analogbefehlen, Richtungswechseln, Graskontakt und Recovery. Über die drei Läufe wurden 104 Kollisionsereignisse und 30 angenommene Rücksetzungen verglichen. [Regressionsvergleich](evidence/first-drive-parity.json)

## K · Offene Punkte

Das Entwicklerreview für Batch 02A und die gesonderte Merge-Entscheidung stehen aus. Die Benchmarkwerte hängen von Hardware, Runtime und Last ab. Die Seed-Modelle sind untrainiert. Die sichtbare Qualität ihrer Fahrentscheidungen war kein Abnahmekriterium. 02B hat keine Umsetzungsfreigabe.

NÄCHSTER PLANUNGSAUFTRAG ERFORDERLICH
