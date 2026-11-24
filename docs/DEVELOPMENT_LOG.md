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
