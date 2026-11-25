# Entwicklungsprotokoll

## ARENA-D00-001 · Technical Foundation · v0.1.0

Codex hat das Repository geprüft. Auf `main` gab es noch keinen Commit. Die vorhandenen lokalen WebStorm-Dateien wurden über die Git-Ignore-Regeln ausgenommen.

Codex hat das Projekt mit React, React DOM und Three.js eingerichtet. Hinzu kamen TypeScript und die Typdefinitionen für Node.js, React, React DOM und Three.js, Vite mit React-Plugin, Vitest, ESLint mit JavaScript-, TypeScript- und React-Hooks-Regeln sowie Prettier. Die exakten Versionen stehen im Paketmanifest und Lockfile.

Umgesetzt wurden der Startbildschirm, die orthografische Szene, das responsive Canvas, die WebGL-Fehleranzeige und die Freigabe der Renderer-Ressourcen. Hinzu kamen Viewport-Tests, CI und Projektdokumentation.

Der erste Serverstart mit Vite 7 scheiterte mit einem Zugriffsfehler beim esbuild-Konfigurationsloader. Vite 8 startete auf `127.0.0.1:5173` und lieferte HTTP 200. In PowerShell wurde wegen der lokalen Skriptrichtlinie `npm.cmd` verwendet.

Der erste Versuch mit `npm ci` scheiterte an einer durch den laufenden Vite-Server belegten nativen Datei. Nach dem Serverstopp gelang die Installation aus dem Lockfile mit Node.js 24.22.1 und npm 11.19.1.

Typprüfung, Lint, Formatprüfung, Vitest und Produktionsbuild waren einzeln erfolgreich. `npm run check` prüft dieselben Schritte gemeinsam. Vitest meldete neun bestandene Tests. Der Build meldete ein JavaScript-Bundle oberhalb der Vite-Warnschwelle von 500 kB.

Die Browserautomation erreichte das Zeitlimit. Die sichtbare Darstellung, die Größenanpassung beim Ziehen des Fensters und die Fehleranzeige bei fehlendem WebGL 2 stehen zur manuellen Prüfung aus. Die Entwickler müssen die Foundation gegenseitig prüfen und ausdrücklich freigeben. Der Workflow-Lauf auf GitHub steht aus.

## FD-001 · Simulation Core

Der Nutzer meldete die erfolgreiche lokale D00-PC-Prüfung und erfolgreiche GitHub-CI und genehmigte ausdrücklich die vorläufige lokale Umsetzung von FD-001 gemäß G-07 auf `feature/fd-001-simulation-core`. Codex hat diese Meldung als Freigabegrundlage verwendet. Die vollständige D00-Abnahme, das Review durch den zweiten Entwickler, die ausstehenden Laptop-Prüfungen (Vite-Start und Checks) sowie die noch nicht belegten Browser-Sonderfallprüfungen einschließlich WebGL-Fallback bleiben offen. Die Nutzerfreigabe gilt für FD-001.

Codex ergänzte sechs reine TypeScript-Module für 2D-Mathematik, Zahlenvalidierung, feste 60-Hz-Ticks, Echtzeit-Akkumulator, Headless-Ausführung, Mulberry32 und den generischen Snapshot-Vertrag. Die Clock begrenzt jede Frame-Lücke auf 0,25 s und führt bis zu acht Ticks aus. Verworfene Zeit und verworfene Akkumulatorticks werden separat gemeldet. Der verbleibende Bruchteil wird für die Interpolation weitergeführt. Der technische Startbildschirm und die Paketabhängigkeiten wurden nicht geändert.

- Umgebung: Node.js 24.22.1, npm 11.19.1. Der Ausgangstestlauf meldete 9 bestandene Foundation-Tests.
- `npm.cmd run check` war erfolgreich. Typprüfung, ESLint, Prettier, Vitest und Vite-Produktionsbuild liefen vollständig durch. Vitest meldete 35 bestandene Tests in vier Dateien, davon 26 FD-001-Fälle und 9 Foundation-Fälle.
- Die FD-001-Tests prüfen unter anderem Frame-Rest bei Überlast, verworfene Zeit ohne Tickfortschritt, Pause/Resume/Einzelstep, Zeitskalierung, Seed-Wiederherstellung, gleiche Tick-Ergebnisse headless und bei 30/60/144 FPS, Eingabevalidierung und Winkelnormalisierung. Alle sechs Core-Dateien wurden zusätzlich im Strict Mode mit ausschließlich ES2022-Standardtypen typgeprüft.
- Vor der Umsetzung meldete die Formatprüfung drei vorhandene First-Drive-Planungsdateien. Prettier hat Leerraum und Tabellen-Trennzeilen vereinheitlicht. Inhaltlich wurde der FD-001-Status im Implementierungsplan aktualisiert.
- Der Build meldet weiterhin das bestehende Browserbundle mit 753,00 kB (200,81 kB gzip) oberhalb der Vite-Warnschwelle. Der Core ist für FD-001 headless geprüft und wird noch nicht vom Startbildschirm geladen. Ein neuer Browser- oder GitHub-CI-Lauf für FD-001 wurde nicht ausgeführt.

Das menschliche FD-001-Review und die vollständige Foundation-Abnahme stehen aus. Git-Integration erfolgt durch die Entwickler. FD-002 wurde nicht begonnen.

## FD-002 · Vehicle Foundation & Controls

Der Auftraggeber meldete für FD-001 den Commit `6651800`, 35 erfolgreiche Tests und erfolgreiche GitHub Actions für PR #1. Für FD-002 erteilte er eine gesonderte, ausschließlich lokale Ausnahme auf `feature/fd-002-vehicle-controls`. Beim Start war der Working Tree sauber. HEAD `361ac2318922dd2790ab4294d3906026ab235d97` enthält den FD-001-Commit über PR #1 und hat denselben Dateibaum. Die lokale Ausnahme erteilt keine Freigabe für einen Merge in main oder für FD-003. D00-Abnahme und gegenseitiges Review bleiben offen.

Codex ergänzte die GT-01-Definition und Kalibrierungsdaten in SI-Einheiten, validierte unabhängige Fahrzeuginstanzen, den gemeinsamen Steuerungsvertrag und das 18-Tick-Richtungsgate. Hinzu kamen die reine 60-Hz-Tastaturverarbeitung und der Browseradapter für beide Tastenschemata, Pause, Fokus und Listener-Freigabe. Der Architekturvertrag beschreibt die Übergabe an FD-003 und FD-004 sowie das Risiko von Teilmutationen bei Tick-Ausnahmen. Es wurden keine Abhängigkeiten installiert.

- Mit Node.js 24.22.1 und npm 11.19.1 bestand der Ausgangslauf mit 35 Tests. `npm.cmd run check` führte Typprüfung, Lint, Formatprüfung, Vitest und Produktionsbuild erfolgreich aus. Vitest meldete 79 bestandene Tests in acht Dateien, darunter 44 FD-002-Fälle und alle bisherigen 35 Tests.
- 11 reine TypeScript-Module (Core, Fahrzeuge und Eingabelogik ohne Browseradapter) bestanden eine zusätzliche strikte Typprüfung ausschließlich mit ES2022-Standardtypen. Die Browseradapter-Tests verwendeten simulierte Ereignisse über Node EventTarget, darunter `blur` und `visibilitychange`.
- Der lokale Foundation-Preview lieferte HTML, JavaScript und CSS mit HTTP 200 aus. Das JavaScript-Bundle blieb bei 753,00 kB (200,81 kB gzip) und erzeugte die bestehende Vite-Größenwarnung.
- Ein manueller Browserlauf, ein tatsächlicher OS-Alt+Tab und GitHub-CI für FD-002 wurden nicht ausgeführt. Die offenen D00-Prüfungen auf dem zweiten Gerät und die Browser-Sonderfallprüfung bleiben ausstehend. Die physik- und integrationsabhängigen VEH-/CTRL-Kriterien stehen im [Testkatalog](first-drive/FIRST_DRIVE_TESTS.md).

## FD-003 · Recovery der Fahrzeugphysik

### A. Ergebnis und Freigabe

Die freie Bewegung des ARENA GT-01 ist auf dem freigegebenen Recovery-Branch lokal implementiert und bereit für das gegenseitige Entwicklerreview. Der Auftraggeber hatte FD-003 auf einem anderen Rechner bereits erfolgreich umgesetzt. Dessen Quellstand war unvollständig synchronisiert und für diese Arbeit unzugänglich. Grundlage dieser funktionalen Neuimplementierung sind FD-002, die bestätigte Spezifikation und der [Recovery-Auftrag](first-drive/FD-003_CODEX_PROMPT.md). Die Ausnahme gilt ausschließlich für FD-003. Alle vier Leistungsziele sind erreicht. Der lokale Qualitätslauf besteht mit 108 Tests in 14 Dateien.

### B. Gemessene Fahrleistungen

Alle Werte stammen aus dem freien 60-Hz-Lauf ohne Wände auf trockenem Asphalt. Gas und Bremse liegen im jeweiligen Versuch sofort als normalisierte Analogbefehle an. Der Bremstest startet exakt bei 100 km/h. Ausgewertet wird jeweils der erste Tick an der Schwelle.

| Messgröße                        | Ursprüngliche Referenz |               Recovery | Verbindliches Ziel                    | Ergebnis                                  |
| -------------------------------- | ---------------------: | ---------------------: | ------------------------------------- | ----------------------------------------- |
| 0–100 km/h                       |    3,817 s / 229 Ticks | 3,816667 s / 229 Ticks | 3,5–4,1 s                             | Bestanden                                 |
| Höchstgeschwindigkeit, 180 s     |           248,341 km/h |        248,341174 km/h | 245–255 km/h                          | Bestanden                                 |
| Bremsweg 100–0 km/h              |               31,175 m |            31,174882 m | 29–35 m                               | Bestanden                                 |
| Bremsdauer                       |    2,283 s / 137 Ticks | 2,283333 s / 137 Ticks | Messwert ohne eigenen Abnahmekorridor | Referenz auf drei Dezimalstellen erreicht |
| Rückwärtsspitze aus Eigenantrieb |            29,676 km/h |         29,675641 km/h | ≤ 30 km/h                             | Bestanden                                 |
| Gripgrenze je Achse, Asphalt     |            7.970,625 N |            7.970,625 N | μ·Fz                                  | Bestanden                                 |
| Gripgrenze je Achse, Gras        |            2.869,425 N |            2.869,425 N | μ·Fz                                  | Bestanden                                 |

In der letzten Sekunde des Vorwärtslaufs betrug die Geschwindigkeitsspanne 0 km/h. Die Bremskurve begann mit Weltgeschwindigkeit (24, 3) m/s, Heading null und Giergeschwindigkeit 0,2 rad/s auf Asphalt. In allen 120 Ticks wirkten an der Vorderachse Längs- und Seitenkraft gleichzeitig. Höchste absolute Werte waren 0,501980 rad Lenkwinkel und 0,629794 rad/s Giergeschwindigkeit. Die höchste Gripauslastung lag bei 1,0000000000000002. Der größte positive Zuwachs der translatorischen plus rotatorischen Bewegungsenergie betrug in diesem Szenario 0 J.

### C. Technische Umsetzung

Der Antrieb liefert je nach lokaler Längsgeschwindigkeit den kleineren Wert aus 9.800 N und 85 % der Motorleistung geteilt durch die Geschwindigkeit mit Mindestnenner 1 m/s. Das Pedal skaliert den Betrag, die freigegebene Richtung bestimmt das Vorzeichen. Der Vorwärts-Taper sinkt linear von 240 bis 260 km/h. Rückwärts gelten Faktor 0,35 und Taper 25–30 km/h. Äußerer Geschwindigkeitsüberschuss unterliegt den regulären Kräften. Volle Bremse fordert insgesamt Masse mal 12 m/s² an. Jede Achse bremst entgegen ihrer longitudinalen Kontaktbewegung bis höchstens zum Stillstand. Antrieb und Bremse verteilen sich gleichmäßig auf beide Achsen. Die Reifen übertragen nur die im gemeinsamen Gripbudget verfügbaren Kräfte.

Der quadratische Luftwiderstand verwendet die tatsächliche Weltbewegung. Je Achse kommt Rollwiderstand aus dem aktuellen Koeffizienten mal Normallast hinzu. Beim Stillstand bleibt die Normierung des Geschwindigkeitsvektors aus. Beim letzten Bremsschritt kann der Widerstand höchstens den verbleibenden Impuls in Bewegungsrichtung aufbrauchen.

Die Lenkhülle fällt mit dem Quadrat der Geschwindigkeit. Bei 30 m/s ergibt sich beispielsweise ein Lenkziel von höchstens 6°. Ein Rad bei 30° kann im nächsten Tick bis 28° zurücklaufen. Bei langsamer Fahrt bestimmt u·tan(δ)/L die angestrebte Giergeschwindigkeit und der hintere Achsabstand mal Zielgier die angestrebte Seitengeschwindigkeit. Der Kraft- und Momentbedarf für die Annäherung über 0,12 s wird auf beide Reifen verteilt.

Das dynamische Einspurmodell addiert zum seitlichen Schwerpunktanteil vorne lf·r und hinten −lr·r. Der gedrehte Vorderreifen sieht andere Längs- und Querkomponenten als die Karosserie. Aus der seitlichen Komponente und dem Betrag der longitudinalen Komponente mit Mindestnenner 1 m/s entsteht der Schlupfwinkel. Die Schräglaufsteifigkeit liefert die Gegenkraft. Zwischen 5 und 15 km/h mischt Smoothstep beide Seitenkraftmodelle. Erst danach skaliert jede Achse ihren gesamten Kraftvektor proportional auf höchstens μ·Fz. Geht vorne Grip verloren, ändert sich das Giermoment anders als bei einem Verlust hinten. Die Weltgeschwindigkeit kann dabei vom Heading abweichen.

Die Vorderachskraft wird zurück in Fahrzeugachsen gedreht. Das Giermoment ergibt sich aus beiden seitlichen Kraftkomponenten mit ihren vorzeichenbehafteten Hebelarmen. Der semi-implizite Euler-Schritt aktualisiert Weltgeschwindigkeit und Giergeschwindigkeit. Die begrenzte Zusatzdämpfung reduziert Querbewegung um 0,5/60 und Giergeschwindigkeit um 0,7/60 ihres jeweiligen Werts. Position und Heading folgen aus den neuen Geschwindigkeiten. Der Winkel bleibt in [−π, π). Das Modell richtet das Fahrzeug beim Rutschen nicht automatisch aus.

Vorne und hinten gibt es getrennte Materialproben. Neue niedrigere Haftung gilt sofort. Beim Wechsel zu Gras nimmt der Rollwiderstandskoeffizient im ersten Tick den Wert 0,025833 an, im dritten 0,0475 und im sechsten 0,08. Ein weiterer Wechsel startet bei den effektiv erreichten Koeffizienten.

### D. Tickfehler und sichere Fortsetzung

Die Session besitzt ihr Fahrzeug und die bestätigte Frame-Referenz. Pro Tick verarbeitet sie eine Eingabequelle. Beide Quellen verwenden das FD-002-Gate genau einmal. Bereits zugelassene Befehle gelangen unmittelbar an die freie Dynamik. Bewegung, tatsächlicher Lenkwinkel, Richtung und Haltezeit, Tastaturfilter, beide Achszustände mit Übergängen, Resetstatus sowie Diagnosen entstehen als neue Version. Der Konstruktor kopiert die Startwerte. Der Tick prüft den Kandidaten und friert seine Daten vor dem Austausch der einzigen bestätigten Referenz ein.

Der Fehlertest hat zunächst einen vollständigen Tastaturframe mit Glättung, laufendem Richtungstimer und Diagnosen veröffentlicht. Im Folgetick lieferte die vordere Messstelle Gras, die hintere warf eine Ausnahme. Objektidentität und vollständiger Inhalt des alten Frames blieben erhalten. Der nächste Schritt wurde vor jeder neuen Untergrundabfrage abgewiesen. Der Host erhält Fahrzeug-ID, Ticknummer und Fehlerursache. Den dokumentierten sicheren Neustart bilden eine korrigierte Abfrage, validierter Startzustand, neue Clock und Session sowie frische bzw. aufgezeichnete Eingaben und passender Seed. Die fehlgeschlagene Session besitzt keinen Entsperrschalter. Eine Clock-Pause erst nach Verlassen des fehlerhaften Callbacks auslösen.

FD-005/007 müssen später alle freien Kandidaten, Kontaktzustände, Fortschritt und Veröffentlichungen gemeinsam behandeln. Einzelne erfolgreich veröffentlichte Fahrzeuge lassen sich in einem fehlgeschlagenen Welttick nicht als gemeinsame Version behandeln.

### E. Dateien und Schnittstellen

| Neue Dateien                                                                                          | Aufgabe                                                             |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/physics/vehicleTick.ts`                                                                          | TickCommand, VehicleFrame und VehicleTickSession                    |
| `src/physics/vehicleDynamics.ts`                                                                      | Freier Bewegungskandidat und optionale Achs-/Fahrzeugdiagnosen      |
| `src/physics/longitudinal.ts`, `src/physics/handling.ts`                                              | Antrieb, Bremse, Luftwiderstand, Lenkung und Langsamfahrt           |
| `src/physics/tires.ts`, `src/physics/surface.ts`                                                      | Reifensystem, Reibungskreis, Materialproben, Materialübergänge      |
| `src/physics/motion.ts`, `src/physics/stabilization.ts`                                               | Impulsbegrenzung, Integration und dissipative Dämpfung              |
| `scripts/calibrate.mjs`, `scripts/calibration.ts`                                                     | Lokaler Node-Einstieg und reproduzierbare Messszenarien             |
| `tests/physics/fixture.ts`                                                                            | Einzelwagensession mit wählbarer Oberfläche und Tickbefehl          |
| `tests/physics/longitudinal.test.ts`, `tests/physics/handling.test.ts`, `tests/physics/tires.test.ts` | Längsbewegung, Lenkgrenzen, Schlupf, Achskräfte                     |
| `tests/physics/surface.test.ts`, `tests/physics/energy.test.ts`, `tests/physics/integration.test.ts`  | Untergründe, Energie, Steuerung, Fehlervertrag und Zeitbasis        |
| `tsconfig.headless.json`, `docs/first-drive/FD-003_CODEX_PROMPT.md`                                   | Wiederholbare Typprüfung und vollständige fachliche Auftragsfassung |

Inhaltlich geänderte Bestandsdateien sind `src/vehicles/vehicle.ts` und `src/vehicles/vehicleSetup.ts` für Achsübergänge, Validierung und Solverparameter, `package.json` und `tsconfig.json` für Prüflauf und Kalibrierung, außerdem `README.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/TASKS.md`, `docs/first-drive/FIRST_DRIVE_SPEC.md`, `docs/first-drive/FIRST_DRIVE_TASKS.md` und `docs/first-drive/FIRST_DRIVE_TESTS.md`.

FD-004 kann eine reine `SurfaceQuery` bereitstellen. FD-005 kann `calculateFreeMotion` verwenden und den Kandidaten mit Abmessungen, Masse und Trägheit aus der Fahrzeugdefinition vor der Weltveröffentlichung weiterverarbeiten. FD-006 kann aus `frame.physics` Kräfte in Reifen- und Fahrzeugachsen, Auslastung, Schlupf, Lenkwinkel und Materialübergänge lesen. Die [Architektur](ARCHITECTURE.md) beschreibt Aufrufreihenfolge und Zeitbezug.

### F. Prüfprotokoll

| Art                 | Ausgeführte Prüfung                                                                                                              | Ergebnis                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatisch         | FD-002-Ausgangslauf `npm.cmd run check`                                                                                          | 79/79 in acht Dateien, TypeScript, ESLint, Prettier und Vite erfolgreich                                                                            |
| Automatisch         | Stufenprüfungen mit Vitest                                                                                                       | Zunächst fünf Längstests, anschließend acht Tests mit Langsamfahrt, danach elf mit Reifendynamik erfolgreich                                        |
| Automatisch         | Vollständiger lokaler `npm.cmd run check`                                                                                        | 108/108 in 14 Dateien, davon 79 bestehende und 29 neue Tests. Typprüfung, Lint, Formatprüfung und Produktionsbuild erfolgreich                      |
| Automatisch         | Headless-Projekt mit `tsc -p tsconfig.headless.json`                                                                             | 20 Module mit ES2022 und ohne DOM-/Node-Typen. Sechs Core-, drei Fahrzeug-, zwei Input-, acht Physikmodule und das Messprogramm                     |
| Automatisch         | Identische Tickeingaben und Seed                                                                                                 | Vollständige Frames nach 240 Ticks headless und bei 30/60/144 FPS identisch. Kein Tick verworfen                                                    |
| Praktisch, headless | `npm.cmd run calibrate` sowie vollständiger Vergleich zweier separater Node-Prozesse                                             | JSON-Ausgaben bytegleich. Auf diesem i7-13620H vergingen einschließlich Prozessstart rund 0,93 s und 0,88 s. Einzelmessungen, keine Mindestleistung |
| Praktisch, Browser  | Lokale Vite-Produktions-Preview in Headless-Chrome geöffnet und Screenshot visuell geprüft                                       | Titel und Untertitel sowie orthografisches Raster, Würfel und Ring sichtbar. Preview und zugehöriger Browserdienst beendet                          |
| Vorbereitet         | Streckenabfrage, Kollisionskandidat, Diagnosedaten und Vertrag für mehrere Fahrzeuge                                             | Einzelfahrzeug-Schnittstellen mit Fixtures geprüft. Mehrfahrzeugvertrag dokumentiert                                                                |
| Offen               | Zweites Gerät, gegenseitiges Code- und Fahrreview, WebGL-Fehlerpfad, OS-Alt+Tab, neue GitHub-CI und D00/G-07                     | Kein menschlicher oder paketübergreifender Abnahmestatus                                                                                            |
| Offen               | Reale Strecke, Kontakte und Nachkontaktverhalten, sichere Strecken-Recovery, grafischer Fahrzeugabgleich, HUD, atomarer Welttick | Prüfung in FD-004–007                                                                                                                               |

Die einzige Buildwarnung betraf das bekannte 753,00-kB-JavaScript-Bundle (200,81 kB gzip). Der Foundation-Build erzeugte vor und nach der Physikarbeit dieselben benannten JS- und CSS-Artefakte.

### G. Kalibrierung und Abweichungen

Es wurde kein vorhandener physikalischer Nenn- oder Setupwert nachkalibriert. Die ergänzenden Relaxations-, Dämpfungs- und Nennerwerte stammen aus dem ursprünglichen Bericht. Die Geradeauswerte stimmen auf dessen veröffentlichte Genauigkeit einschließlich beider Tickzahlen überein. Die explizite numerische Ruhebehandlung bei 10⁻⁹ m/s erfasst auch die Rotation an den Achsen. Ein Test startet mit 0,04 m/s rein seitlicher Bewegung und weist nach dem Tick verbleibenden Schlupf nach.

Die Struktur umfasst wie vorgesehen acht Physikmodule, sechs Testdateien und ein Fixture. Die Recovery gruppiert die Abdeckung in 29 neue Tests gegenüber ursprünglich 31. Die zusätzliche Headless-Konfiguration bindet den isolierten Typnachweis dauerhaft in den Qualitätslauf ein. Ein Vergleich des genauen Quellcodes, der damaligen Testfälle oder einzelner Kurventrajektorien ist mangels ursprünglichem Quellstand offen.

### H. Einstieg für das Entwicklerreview

1. In `vehicleTick.ts` bei `step` beginnen. Einen gehaltenen Rückwärtsbefehl durch den 17. und 18. Tick verfolgen. Dann im Hinterachs-Fehlertest prüfen, an welcher einzigen Zuweisung ein Frame für den Host sichtbar wird.
2. In `vehicleDynamics.ts` die Koordinatensysteme markieren. Bei eingeschlagenem Vorderrad ist dessen longitudinale Reifenkraft im Fahrzeugkoordinatensystem auch seitlich wirksam. Diesen Beitrag zum Giermoment anhand von `toBody` und dem Integrationstest nachrechnen.
3. In `surface.ts` und `tires.ts` eine Achse beim Wechsel auf Gras verfolgen. Bei 6.376,5 N statischer Normallast ergeben 1,25 bzw. 0,45 die gemessenen Grenzen. An einer Bremskurve zeigen, wie beide Kraftkomponenten mit demselben Faktor kleiner werden.
4. In `scripts/calibration.ts` die Startbedingungen und Abbruchbedingungen nachlesen. Mit `npm run calibrate` das Messprotokoll erzeugen und die Zeitangaben durch Division der Tickzahlen durch 60 prüfen. Für die Erklärung des Stillstands die Impulsbegrenzung in `motion.ts` der Richtungsschwelle im FD-002-Gate gegenüberstellen.

### I. Lokaler Git- und Umgebungsstand

Branch `recovery/fd-003-vehicle-physics`, HEAD und FD-002-Basis `a865f03ce8d2e4fa9ccbbea413d182148c897e92`. Node.js 24.22.1 und npm 11.19.1. Die Manifestabhängigkeiten waren lokal vorhanden. Alle Arbeitsänderungen sind ungestagt. Die Dateiliste in E enthält die neuen und inhaltlich geänderten Dateien dieser Recovery. Es gab keinen Commit, Push oder Merge.

Beim Start zeigte der Arbeitsbaum bereits 45 als geändert gemeldete Bestandsdateien und eine unversionierte `.gitattributes` mit `* text=auto eol=lf`. Der Git-Inhaltsdiff der Bestandsdateien war leer. `git ls-files --eol` wies für die geprüften Quellen und Dokumente LF aus. Git für Windows setzt systemweit `core.autocrlf=true`, das Repository lokal `false`. Prettier bestand bereits im Ausgangslauf. Deshalb wurde keine weitere Massenkonvertierung vorgenommen. Einige von Prettier ausgenommene Dateien, darunter das Lockfile, lagen im Arbeitsbaum noch mit CRLF vor. Die vorhandene Attributdatei, globale Einstellungen und Lockfile wurden beibehalten.
