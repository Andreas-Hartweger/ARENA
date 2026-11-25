# PROJECT ARENA

PROJECT ARENA ist ein lokal im Browser laufender AI Racing & Evolution Simulator in Entwicklung. Version 0.1.0 gehört zum Meilenstein **Technical Foundation** und zeigt eine orthografische Three.js-Testszene.

## Einrichtung in WebStorm

Beide Entwickler öffnen dasselbe Projektverzeichnis im eigenen Checkout in WebStorm und wählen Node.js 24 LTS als Projektinterpreter. Voraussetzungen sind Git, npm und ein Browser mit WebGL 2. Für die erste Installation wird Zugriff auf die npm-Registry benötigt.

```sh
npm ci
npm run dev
```

Öffne die vom Server ausgegebene lokale URL. In PowerShell kann bei gesperrtem `npm.ps1` jeweils `npm.cmd` verwendet werden.

## Build und Prüfungen

- `npm run build` erstellt die Browserdateien in `dist/`.
- `npm run preview` zeigt den Build über einen lokalen HTTP-Server.
- `npm run test` führt die Unit-Tests einmal aus. `npm run test:watch` führt sie bei Änderungen erneut aus.
- `npm run format` formatiert die Projektdateien. `npm run check` bündelt Typprüfung, Lint, Formatprüfung, Tests und Build.

## Zusammenarbeit

Für ein freigegebenes Arbeitspaket einen Branch vom aktuellen `main` erstellen. Vor dem Pull Request `npm run check` ausführen und Änderungen sowie offene Prüfungen dokumentieren. Der zweite Entwickler installiert mit `npm ci`, prüft Code und Darstellung und gibt Rückmeldung im Pull Request. Änderungen werden gegenseitig überprüft. Beide Entwickler müssen die Foundation ausdrücklich freigeben, bevor weitere Spielmechaniken umgesetzt werden.

Siehe [Projektübersicht](docs/PROJECT_OVERVIEW.md), [Architektur](docs/ARCHITECTURE.md) und [Aufgaben](docs/TASKS.md).

## FD-003 lokal prüfen

`npm run calibrate` führt den GT-01 in Node.js auf definierten Testuntergründen aus und gibt die Messwerte als JSON aus. `npm run check` prüft zusätzlich den Simulationskern mit ausschließlich ES2022-Standardtypen. Die lokale Recovery umfasst die freie Bewegung eines Fahrzeugs. Der Browser zeigt weiterhin die Foundation-Testszene. Messwerte, Review-Einstieg und offene Abnahmen stehen im [Entwicklungsprotokoll](docs/DEVELOPMENT_LOG.md#fd-003--recovery-der-fahrzeugphysik).
