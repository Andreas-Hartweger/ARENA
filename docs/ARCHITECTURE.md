# Architektur

PROJECT ARENA bleibt zunächst ein modulares Einzelprojekt. `src/app` enthält den React-Einstieg und die UI. React verwaltet den UI-Zustand mit Bordmitteln. `src/styles` enthält normales CSS. `src/rendering` besitzt die Three.js-Szene, die orthografische Kamera, die Größenanpassung und die GPU-Ressourcen. Tests unter `tests` prüfen reine Berechnungen mit Vitest in Node.js.

Die spätere Simulation rechnet zweidimensional. Die Fahrzeugphysik bleibt von Three.js unabhängig. Menschliche und künstliche Fahrer sollen dieselben Steuerbefehle nutzen. Die KI bleibt unabhängig von React und Rendering, damit das Training headless laufen kann. Three.js visualisiert den Simulationszustand als räumlich wirkendes 2D. Die Schnittstellen und Module entstehen mit den zuständigen Arbeitspaketen.

Der Startbildschirm benötigt WebGL 2 für die Darstellung. Die Szene zeichnet bei Initialisierung und Größenänderung. Der erste Release läuft offline, sobald die Dateien lokal bereitstehen. Standard und Advanced sind die einzigen geplanten Bedienungsebenen. Später kommt eine Desktop-Variante optional infrage.

Offen sind die konkreten Simulationsschnittstellen, die Spielerprofil-Verwaltung, das Speicherformat und die Technologie einer möglichen Desktop-Variante.
