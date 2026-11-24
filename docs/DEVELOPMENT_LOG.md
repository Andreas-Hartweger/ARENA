# Entwicklungsprotokoll

## ARENA-D00-001 · Technical Foundation · v0.1.0

Codex hat das Repository geprüft. Auf `main` gab es noch keinen Commit. Die vorhandenen lokalen WebStorm-Dateien wurden über die Git-Ignore-Regeln ausgenommen.

Codex hat das Projekt mit React, React DOM und Three.js eingerichtet. Hinzu kamen TypeScript und die Typdefinitionen für Node.js, React, React DOM und Three.js, Vite mit React-Plugin, Vitest, ESLint mit JavaScript-, TypeScript- und React-Hooks-Regeln sowie Prettier. Die exakten Versionen stehen im Paketmanifest und Lockfile.

Umgesetzt wurden der Startbildschirm, die orthografische Szene, das responsive Canvas, die WebGL-Fehleranzeige und die Freigabe der Renderer-Ressourcen. Hinzu kamen Viewport-Tests, CI und Projektdokumentation.

Der erste Serverstart mit Vite 7 scheiterte mit einem Zugriffsfehler beim esbuild-Konfigurationsloader. Vite 8 startete auf `127.0.0.1:5173` und lieferte HTTP 200. In PowerShell wurde wegen der lokalen Skriptrichtlinie `npm.cmd` verwendet.

Der erste Versuch mit `npm ci` scheiterte an einer durch den laufenden Vite-Server belegten nativen Datei. Nach dem Serverstopp gelang die Installation aus dem Lockfile mit Node.js 24.22.1 und npm 11.19.1.

Typprüfung, Lint, Formatprüfung, Vitest und Produktionsbuild waren einzeln erfolgreich. `npm run check` prüft dieselben Schritte gemeinsam. Vitest meldete neun bestandene Tests. Der Build meldete ein JavaScript-Bundle oberhalb der Vite-Warnschwelle von 500 kB.

Die Browserautomation erreichte das Zeitlimit. Die sichtbare Darstellung, die Größenanpassung beim Ziehen des Fensters und die Fehleranzeige bei fehlendem WebGL 2 stehen zur manuellen Prüfung aus. Die Entwickler müssen die Foundation gegenseitig prüfen und ausdrücklich freigeben. Der Workflow-Lauf auf GitHub steht aus.
