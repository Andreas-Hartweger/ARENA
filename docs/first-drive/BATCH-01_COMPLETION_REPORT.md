# PROJECT ARENA · First Drive 0.2.0-rc.1

## A. Zusammenfassung

Der GT-01 lässt sich nach `npm ci` und `npm run dev` direkt auf Academy fahren. Der Kandidat ist lokal technisch geprüft. Die vorläufige Entwicklung trotz offener D00-/G-07-Abnahme erfolgte unter der begrenzten Batch-Freigabe.

| Paket  | Ergebnis                                                               | Vollständiger lokaler Testlauf |
| ------ | ---------------------------------------------------------------------- | ------------------------------ |
| FD-004 | Analytische Strecke, Tore, Aufstellung und Recovery-Kandidaten         | 116 Tests / 15 Dateien         |
| FD-005 | OBB-Kontakte, Impulsantwort, gemeinsame Welttransaktion                | 124 / 16                       |
| FD-006 | Orthografische Darstellung, GT-01, HUD, Kameras und Eingabe            | 127 / 17                       |
| FD-007 | Integrierte Fahranwendung, Mehrfahrzeugregression und Abnahmemessungen | 134 / 18                       |

## B. Spielbare Funktionen

Der Spieler startet acht Meter hinter der Startlinie. Vorwärts- und Rückwärtsfahrt, Asphalt und Gras je Achse, Barrieren, gerichtete Tore und gewertete Runden arbeiten im selben 60-Hz-Tick. Das HUD zeigt Geschwindigkeit, Pedale, Achsmaterial, Torfortschritt, laufende und letzte gültige Runde sowie FPS. Esc pausiert. R sucht eine freie sichere frühere Pose und verwirft die laufende Runde. C schaltet die Kameras durch, V schaltet die Übersicht um. In freier Ansicht verschieben Ziehen und Mausrad den Ausschnitt bzw. verändern die Sichtbreite. F3 blendet Geometrie, Kräfte, Achsmesspunkte, Geschwindigkeit, Grip und Tickdaten ein.

## C. Technische Architektur

- **Core, Vehicles, Input, Physics.** Die feste Uhr, GT-01-Definition und FD-003-Kräfte bleiben die Grundlage. Der Welttick löst jeden Fahrerwunsch genau einmal auf. Die isolierte Kalibrierung läuft weiterhin ohne Strecke.
- **Tracks.** Linien und Viertelkreise definieren die Strecke. Die analytische Länge beträgt 659,91148575 m. Gemeinsame Stationspunkte liefern Ränder, Curbs, Torpositionen und die 0,30 m dicken Barrierensegmente. Die Oberflächenabfrage projiziert echte Achsmittelpunkte. Torzeiten verwenden den interpolierten Schnittzeitpunkt innerhalb eines akzeptierten Bewegungssegments.
- **Collision und Game.** Die Bewegungs- und Rotationsgrenze reduziert die Kandidatenmenge. SAT liefert Kontaktlage und Normalen, Impulse am Kontaktpunkt ändern Translation und Gier. Eine Positionskorrektur hat weder Geschwindigkeits- noch Torgutschrift. Bei Budgeterschöpfung (höchstens 32 Bewegungsteilschritte und sechs Kontaktiterationen je Teilschritt) bleibt die Kontaktgruppe am letzten akzeptierten Stand stehen. Das Verfahren ist eine begrenzte konservative Annäherung. Die Welt veröffentlicht den nächsten Frame erst nach allen Fahrzeugen, Kontakten, Toren, Recovery und Zustandsprüfungen. Ein Fehler sperrt weitere Schritte; Neustart über eine frische Welt.
- **Rendering und App.** Three.js zeigt die XZ-Ebene aus orthografischer Sicht. Weltpunkt (x,y) entspricht (x,0,−y). Der Browser interpoliert zwischen Weltframes. Nach Spawn oder Recovery fallen alte und neue Pose zusammen. React erhält die Telemetrie mit bis zu 10 Hz. Streckenmesh, Karte, Kontaktgeometrie und Fahrbetrieb verwenden dieselbe kompilierte Strecke.

## D. Tests

Der FD-003-Ausgangspunkt bestand mit 108 Tests in 14 Dateien. Der vollständige Abschlusslauf bestand einschließlich beider Typprüfungen, ESLint, Prettier und Build. Vitest meldete 134 bestandene Tests in 18 Dateien. Die Headless-Konfiguration verwendet ES2022 ohne DOM oder automatische Typ-Pakete. Alle 23 gezielten Strecken-, Kontakt- und Weltprüfungen bestanden. Der vollständige Testkatalog mit Status und Grenzen steht in [FIRST_DRIVE_TESTS.md](FIRST_DRIVE_TESTS.md#prüfstand-des-integrierten-first-drive).

Zwei Fahrzeuge mit Kontakt und identischer tickbasierter Eingabe erreichten nach 240 Ticks bei 30, 60 und 144 simulierten FPS denselben Weltframe wie der Headless-Lauf. Der absichtliche Fehler bei der Hinterachsabfrage des zweiten Fahrzeugs erhielt den gesamten vorherigen Frame. Weitere Regressionen decken deckungsgleiche ruhende Fahrzeuge, unabhängigen Kontaktfallback, Start auf der gegenüberliegenden Geraden, Abkürzung innen auf Gras und Recovery über die Startnaht ab.

## E. Fahrzeugmessungen

`npm run calibrate` führte dieselbe FD-003-Physik in Node aus. Die Parameter und Abnahmegrenzen blieben gleich.

| Messgröße             |          FD-003 |          FD-007 | Ziel            | Ergebnis                                |
| --------------------- | --------------: | --------------: | --------------- | --------------------------------------- |
| 0–100 km/h            |      3,816667 s |      3,816667 s | 3,5–4,1 s       | Bestanden, 229 Ticks                    |
| Höchstgeschwindigkeit | 248,341174 km/h | 248,341174 km/h | 245–255 km/h    | Bestanden, letzte Sekunde ohne Streuung |
| Bremsweg 100–0        |     31,174882 m |     31,174882 m | 29–35 m         | Bestanden                               |
| Bremsdauer            |      2,283333 s |      2,283333 s | Referenzmessung | Übereinstimmung, 137 Ticks              |
| Rückwärtsspitze       |  29,675641 km/h |  29,675641 km/h | ≤ 30 km/h       | Bestanden                               |

Gripgrenzen je Achse 7.970,625 N auf Asphalt und 2.869,425 N auf Gras. In der 120-Tick-Bremskurve maximaler positiver Energiezuwachs 0 J, maximale Gripauslastung 1,0000000000000002.

## F. Browserprüfung

- In echtem Headless Chrome mit lokalem Produktions-Preview beschleunigt, gelenkt und gebremst (55 auf 29 km/h), Gras an beiden Achsen und Stillstand an der inneren Barriere beobachtet. Recovery setzte den Wagen mit 0 km/h auf Asphalt. Escape hielt den Simulationszähler bei Tick 3768. Breites und schmales Layout sowie die drei Kameramodi geprüft.
- Zwei vollständige Runden im Produktionsbuild mit einer vorgegebenen Folge von DOM-Tastaturereignissen und kontrollierten Animationszeitpunkten. Nach 8.466 Eingabeticks zeigte das HUD Runde 03. Die gewerteten Zeiten waren 1:05,93 und 1:06,10. Der gleiche Fahrablauf liegt als Headless-Fixture in tests/game. Die Browserkonsole meldete beim abschließenden Rundenlauf keine Fehler.
- Im laufenden Browser mit emuliertem Offline-Netzwerk fuhr der GT-01 rückwärts mit 14 km/h. Die geladenen JS-/CSS-Ressourcen lagen auf 127.0.0.1. Für einen Kaltstart muss der lokale Webserver erreichbar sein.
- Bei verweigertem WebGL 2 erschien der deutsche Fehlerhinweis. Ein tatsächlicher per WebGL-Erweiterung ausgelöster Kontextverlust zeigte den Neuladehinweis. Beim zweimaligen Starten und Freigeben des Renderers auf einem Canvas in der Entwicklungsanwendung stoppten die Telemetriemeldungen jeweils nach Dispose (5 bzw. 4 Meldungen vor und nach der Wartezeit).
- [Streckenübersicht](evidence/academy-overview.png) und [Fahransicht nach der zweiten gewerteten Runde](evidence/academy-laps.png). Beide Vite-Server und der gestartete Chrome-Testdienst wurden beendet.

## G. Performance

Windows 11 Home Build 26300, Intel Core i7-13620H, installierte Grafikadapter Intel UHD und GeForce RTX 4050 Laptop GPU. Node 24.22.1 und HeadlessChrome 158. Die Auswahl des aktiven Grafikadapters wurde nicht ermittelt.

| Probe                | Messung                                 | Bedingungen                                                                                           |
| -------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Browserbildrate      | 144,02 RAF-Aufrufe/s                    | 240 echte Frameintervalle, 504 × 700, DPR 1, HUD 144 FPS, getrennt vom Replay                         |
| Browser-JS-Heap      | 15,13 MB                                | Einzelne Chrome-Stichprobe, ohne GPU-Speicher                                                         |
| Headless-Durchsatz   | rund 5.000 Weltticks/s                  | Zwei Fahrzeuge auf Academy, 600 Aufwärmticks, anschließend 10.000 Ticks in 2,000 s mit Kontaktprüfung |
| Node-Prozessspeicher | 81,74 → 89,84 MB RSS                    | Vor/nach dieser Messstrecke                                                                           |
| Tests                | 4,74 s                                  | Ein vollständiger Vitest-Lauf, 18 Dateien                                                             |
| Produktionsbuild     | 815,07 kB JS, 4,48 kB CSS, 0,43 kB HTML | gzip 222,07 / 1,71 / 0,28 kB; bekannte Chunkgrößenwarnung                                             |

Die Messungen beschreiben die geprüfte Umgebung. Dauerlast, Speicherentwicklung über längere Sitzungen und schwächere Zielhardware stehen aus.

## H. GitHub

Basis `main` bei `3b85cadb564d4e591c217377f7b21422bd482e00` enthält den FD-003-Recovery-Commit. Zielbranch `feature/batch-01-complete-first-drive`. Die Paket-SHAs und Remote-Nachweise stehen im [Fortschrittsprotokoll](BATCH-01_PROGRESS.md). Der lokale FD-007-Commit und der über `git ls-remote` direkt verifizierte Remote-Ref lauteten beide `b2fb5e230f9bbb0297afe40b7382ba05b9e22838`. Beide PR-Versuche über den Connector ergaben HTTP 403 („Resource not accessible by integration“). Die Suche fand keinen Batch-PR. Die Actions-Abfrage zum FD-007-Commit lieferte null PR-Läufe. PR-Eröffnung und anschließende CI-Prüfung bleiben offen. Die GitHub CLI war lokal nicht installiert. Die CI-Konfiguration reagiert auf PRs nach main und Pushes auf main.

**PR-Titel** · Complete First Drive – FD-004 to FD-007

[Vergleich mit main und PR anlegen](https://github.com/Andreas-Hartweger/ARENA/compare/main...feature/batch-01-complete-first-drive?expand=1)

### Vollständige PR-Beschreibung

#### Spielbarer Umfang

FD-004 ergänzt den analytischen Academy Training Circuit mit Achsuntergründen, Barrieren, acht gerichteten Toren, Zeitnahme und sicheren Recovery-Positionen. FD-005 löst Kontakte zwischen Fahrzeugen und Barrieren sowie zwischen Fahrzeugen auf. Der Welttick veröffentlicht Fahrzeug-, Kontakt- und Rundendaten gemeinsam. FD-006 verbindet die Tastatursteuerung mit GT-01, drei Kameras, HUD und internen Overlays. FD-007 integriert die Regression und kennzeichnet Version 0.2.0-rc.1.

#### Prüfungen

Der lokale Qualitätslauf umfasst TypeScript einschließlich Headless-Prüfung, ESLint, Prettier, 134 bestandene Vitest-Tests in 18 Dateien und den Vite-Produktionsbuild. Zwei Fahrzeuge lieferten bei identischen Tickeingaben headless und bei 30/60/144 FPS denselben Endframe. Getestet wurden unter anderem die 2-cm-Wand bei 250 km/h, Budgeterschöpfung, ein Fehler im zweiten Fahrzeug, Recovery und Abkürzungen. Chrome wertete zwei Tastaturrunden mit 1:05,93 und 1:06,10. Offline-Fahrt und WebGL-Fehlerpfade wurden praktisch geprüft.

#### Messwerte und Review

0–100 km/h in 3,816667 s, Höchstgeschwindigkeit 248,341174 km/h, Bremsweg 31,174882 m, Bremsdauer 2,283333 s, Rückwärtsspitze 29,675641 km/h. Alle vier Leistungsziele sind erfüllt. Bitte insbesondere die Trennung von Bewegung und Positionskorrektur, die atomare Weltveröffentlichung und das Zurücksetzen an der Startnaht prüfen. Der Solver hat ein begrenztes Kontaktbudget mit diagnostiziertem Stopp. Unabhängiger Fahrtest auf Entwicklerhardware, OS-Alt+Tab sowie gemeinsame D00-/G-07-Abnahme bleiben offen. Der Bericht unter `docs/first-drive/BATCH-01_COMPLETION_REPORT.md` enthält Prüfumgebung und Screenshots.

## I. Entwicklerreview

1. In `src/tracks/track.ts` von `createTrack` über `sample` zu `project` gehen. Denselben Punkt an beiden Seiten der Startnaht betrachten. In `progress.ts` nachvollziehen, warum nur die Reihenfolge gerichteter Tore eine Runde abschließt.
2. In `src/game/world.ts` den Weg eines Fahrerwunsches durch `DriveWorld.step` verfolgen. In `src/collision/solver.ts` akzeptierte Bewegungen und verworfene Teilschritte vergleichen. Mit den Tests in `tests/collision` den Unterschied zwischen Kontaktimpuls und rein geometrischer Korrektur prüfen.
3. In `src/rendering/firstDrive.ts` Weltframe, Renderinterpolation und HUD-Takt unterscheiden. In `src/app/App.tsx` den Controller beim Unmount verfolgen. Für eine praktische Gegenprobe mit F3 bremsend auf das innere Gras fahren, R drücken und Rundenzeit, Gripwerte und Pose beobachten.

## J. Offene Abnahme

Das gegenseitige Entwicklerreview, der unabhängige Start auf dem zweiten Rechner, das subjektive Fahrgefühl und die gemeinsame D00-/G-07-Abnahme stehen aus. Tatsächliches OS-Alt+Tab sowie ein Fahr- und Performancevergleich auf schwächerer Hardware sind offen. Der Release-Kandidat erhielt keine endgültige Releasefreigabe.

## K. Nächster Entwicklungsstand

Für eine spätere First-Intelligence-Freigabe müssen die Entwickler den First-Drive-Kandidaten samt offenen Prüfungen gemeinsam abnehmen und den Folgeauftrag festlegen. Als technische Grundlage stehen die reproduzierbare Welt, gemeinsame Steuerbefehle und der unabhängige Kontaktmodus bereit.
