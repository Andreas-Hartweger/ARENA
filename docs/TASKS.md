# Aufgaben

## ARENA-D00-001 – Technical Foundation · v0.1.0

| Aufgabe               | Status       | Abnahmekriterium                                                                                          |
| --------------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| Projekt und Werkzeuge | Umgesetzt    | Node.js 24, npm-Lockfile, Strict Mode und definierte npm-Skripte                                          |
| Startbildschirm       | Umgesetzt    | Orthografische Szene, responsive Fläche, WebGL-Fehlermeldung und Ressourcenfreigabe                       |
| Unit-Tests            | Umgesetzt    | Größenberechnung mit Normalfällen und Randfällen ohne GPU                                                 |
| CI                    | Konfiguriert | Pull Requests und Pushes auf `main` führen `npm ci` und `npm run check` aus                               |
| Dokumentation         | Umgesetzt    | Einrichtung, Architektur, Entscheidungen, Roadmap und Arbeitsprotokoll                                    |
| Abnahme               | Ausstehend   | Darstellung und Fehleranzeige im Browser prüfen, Änderung gegenseitig reviewen und ausdrücklich freigeben |

Prüfergebnisse stehen im [Entwicklungsprotokoll](DEVELOPMENT_LOG.md). Der nächste Meilenstein ist First Drive. Weitere Spielmechaniken bleiben bis zur ausdrücklichen Freigabe gesperrt.

## FD-001 – Simulation Core

Lokal umgesetzt auf `feature/fd-001-simulation-core` mit ausdrücklich genehmigter G-07-Ausnahme nach gemeldeter erfolgreicher PC-Prüfung und GitHub-CI. Abnahmekriterien sind die 60-Hz-Tick-API, Überlastbehandlung, Pause und Einzelstep, Headless-Ausführung, reproduzierbarer Zufallszustand, 2D-Mathematik und Tests ohne Browser oder GPU.

FD-001 ist in der lokalen Basis über PR #1 enthalten. Laut Auftraggeber war der GitHub-Actions-Lauf erfolgreich. Das gegenseitige Review und die vollständige Foundation-Abnahme stehen aus.

## FD-002 – Vehicle Foundation & Controls

Lokal umgesetzt auf `feature/fd-002-vehicle-controls` unter der separat erteilten FD-002-Ausnahme. Abnahmekriterien für dieses Paket sind validierte GT-01-Daten, unabhängige Instanzen, gemeinsame Steuergrenzen, Richtungsgate, 60-Hz-Tastaturverarbeitung und Browseradapter mit Ereignis- und Listener-Tests. Physikabhängige Kriterien sind im [Testkatalog](first-drive/FIRST_DRIVE_TESTS.md) ausgewiesen.

Review und vollständige Foundation-Abnahme stehen aus. Die Ausnahme erteilt keine Freigabe für einen Merge in main. Zum Abschluss von FD-002 standen die Freigaben für FD-003 und alle weiteren Pakete aus. Siehe [First-Drive-Plan](first-drive/FIRST_DRIVE_TASKS.md).

## FD-003 – Freie Fahrzeugdynamik

Die gesonderte Recovery-Freigabe ersetzt für FD-003 die Sperre aus dem FD-002-Abschluss. 003a bis 003d sind lokal umgesetzt und geprüft. Die vier Leistungsziele, der Fehlervertrag und die bildratenunabhängige Headless-Ausführung sind im [Abschlussbericht](DEVELOPMENT_LOG.md#fd-003--recovery-der-fahrzeugphysik) belegt. Ausstehend sind gegenseitiges Review, G-07 und die paketübergreifende Abnahme in FD-007. FD-004 und weitere Pakete benötigen eine eigene Freigabe.
