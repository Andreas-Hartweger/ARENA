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

Das gegenseitige Review und die vollständige Foundation-Abnahme stehen aus. FD-002 und alle weiteren Aufträge bleiben gesperrt. Siehe [First-Drive-Plan](first-drive/FIRST_DRIVE_TASKS.md).
