# PROJECT ARENA

PROJECT ARENA ist ein lokal im Browser laufender AI Racing & Evolution Simulator in Entwicklung. Der interne Release-Kandidat **0.2.0-rc.1 – First Drive** startet direkt mit dem GT-01 auf dem Academy Training Circuit.

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

## First Drive fahren

W oder ↑ gibt Gas. S oder ↓ bremst und schaltet nach gehaltenem Gegenbefehl im Stand auf Rückwärtsfahrt. A/D oder ←/→ lenken. Esc pausiert, R setzt auf eine freie, zuvor überprüfte Position zurück. C wechselt zwischen den drei Kameras. V schaltet die Übersicht um. In der freien Kamera verschiebt Ziehen die Ansicht, das Mausrad zoomt. F3 zeigt Kontaktebenen, Achsen, Kräfte und Grip. Die Zeitnahme beginnt beim ersten gerichteten Überfahren der Startlinie. Alle sieben weiteren Tore sind für eine gültige Runde erforderlich.

Die gesonderte Batch-Freigabe, Browserfahrten, Messungen und offenen menschlichen Prüfungen stehen im [Abschlussbericht](docs/first-drive/BATCH-01_COMPLETION_REPORT.md).

## KI-Testfahrt und Inspector

Die Fahrt startet mit menschlicher Steuerung. Drücke **F3**, wähle unter **Interner Test · Fahrer** das **Mathematische Testmodell** und klicke auf **Inspector öffnen**. Bei diesem Modell beträgt das Zielgas konstant 60 %. In der Tabelle **Fahrbefehle** stehen KI-Ziel und angewandter Befehl mit ihrem jeweiligen Tick. Mit **Pause** und **Einzeltick** lässt sich die Simulation schrittweise prüfen. Der erste Einzeltick nach dem Öffnen enthält nur dann neue Netzwerte, wenn eine Entscheidung fällig ist.

**Seed 42 · untrainiert** verwendet reproduzierbare Zufallsgewichte. Der Sensor Inspector zeigt die Sichtstrahlen und die Messwerte am angegebenen Messtick. Im Brain Inspector lassen sich Schicht, Neuron und Eingangsverbindung auswählen. Ein Wechsel zurück auf **Mensch** startet eine frische Fahrt. Die Messergebnisse und offenen Freigaben stehen im [Bericht zu Batch 02A](docs/first-intelligence/BATCH-02A_COMPLETION_REPORT.md).

## Trainingslabor und Modelle

Im Menü der Testfahrt führt **Trainingslabor** zum Laufentwurf. Strecke, Fahrzeug und Modellversion lassen sich auch aus ihrem jeweiligen Bereich übernehmen. Nach der Vorprüfung startet **Training starten** den Lauf. **Headless** und **Max** rechnen mit dem gewählten Workerprofil ohne grafische Beobachtung und ohne Echtzeitwartezeit. Die reguläre Referenz verwendet 60 Hz für die Physik und 30 Hz für Sensorik und Inferenz.

Unter **Modelle** lassen sich Versionen anlegen, klonen und unter einem gemeinsamen Szenario vergleichen. **Speicher** zeigt Checkpoints, Datenbudget, Paketimport und Backups. Für spätere Sitzungen denselben Browser, dasselbe Profil und dieselbe lokale Serveradresse einschließlich Port verwenden. Der Prüfumfang und die Bedienhinweise stehen im [Bericht zum Trainingslabor](docs/training-management/BATCH-02C_COMPLETION_REPORT.md).

## Fahrzeugphysik lokal prüfen

`npm run calibrate` führt den GT-01 in Node.js auf definierten Testuntergründen aus und gibt die Messwerte als JSON aus. `npm run check` prüft zusätzlich den Simulationskern mit ausschließlich ES2022-Standardtypen. Die Kalibrierung isoliert die freie Bewegung auf definiertem Untergrund. Im Browser verarbeitet der Welttick zusätzlich Streckenkontakte, Tore und Recovery. Messwerte, Review-Einstieg und offene Abnahmen stehen im [Entwicklungsprotokoll](docs/DEVELOPMENT_LOG.md#fd-003--recovery-der-fahrzeugphysik).
