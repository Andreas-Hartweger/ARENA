# Technische Entscheidungen

- Bestätigt sind TypeScript im Strict Mode, React mit Bordmitteln, normales CSS, Three.js, Vite, Node.js 24 LTS und npm.
- Vitest, ESLint, Prettier, Git und GitHub Actions bilden die Prüfwerkzeuge. WebStorm ist die gemeinsame Entwicklungsumgebung. Das Lockfile hält die aufgelösten Versionen fest.
- Die Browserversion kommt zuerst. Die grafische Darstellung ist orthografisch und dient im aktuellen Meilenstein als technischer Startbildschirm.
- Simulation, Grafik, KI und UI haben eigene Verantwortlichkeiten. Die Simulation beginnt zweidimensional. Die Renn-KI braucht keine externen KI-Dienste.
- Der Offline-Kern, die Bedienungsebenen Standard und Advanced sowie das modulare Einzelprojekt sind bestätigt.
- Versionsnummern werden mit benannten Meilensteinen kombiniert. Beide Entwickler prüfen Änderungen gegenseitig und geben die Foundation ausdrücklich frei.

Offen bleiben Spielerprofile, konkrete Simulationsschnittstellen und die Umsetzung einer optionalen Desktop-Version.
