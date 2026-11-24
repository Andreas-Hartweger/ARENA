# FD-002 · Vehicle Foundation & Controls

## Freigabe und Ausgangslage

FD-001 wurde lokal mit 35 bestandenen Tests implementiert und als Commit `6651800` in Pull Request #1 gespeichert. Laut Auftraggeber war GitHub Actions für den PR erfolgreich. Das gegenseitige Entwicklerreview und die vollständige D00-Abnahme stehen aus. Der Auftraggeber genehmigt ausdrücklich ausschließlich FD-002 als vorläufige lokale Ausnahme auf `feature/fd-002-vehicle-controls`, basierend auf FD-001. Diese Ausnahme wird dokumentiert. Sie erteilt keine Freigabe für einen Merge in main oder den Beginn von FD-003.

## 1. Vorbereitung

Lies `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/DEVELOPMENT_LOG.md`, `docs/TASKS.md` sowie `FIRST_DRIVE_SPEC.md`, `FIRST_DRIVE_TASKS.md` und `FIRST_DRIVE_TESTS.md` vollständig. Untersuche den Simulationskern und seine Tests. Prüfe Branch, Basiscommit und Working Tree. Stelle vor der Umsetzung einen kurzen Plan auf. Die bestätigte First-Drive-Spezifikation ist verbindlich.

## 2. Fahrzeuggrundlage

Implementiere die datenbasierte Definition des ARENA GT-01. Trenne `VehicleDefinition` (unveränderliche Nennwerte), `VehicleSetup` (kalibrierbare Werte), `VehicleState` (dynamischer Zustand) und `VehicleAppearance` (Farbe und Startnummer). Verwende alle bestätigten Werte in SI-Einheiten. Mehrere Fahrzeuge dürfen dieselbe Definition verwenden und müssen voneinander unabhängige Zustände besitzen. Berücksichtige eindeutige Fahrzeug-ID, Position am geometrischen Mittelpunkt, Heading, Weltgeschwindigkeit, Giergeschwindigkeit, tatsächlichen Lenkwinkel, Fahrtrichtung, Achsoberflächen mit Übergängen, Resetstatus und Darstellungsdaten. Validiere numerische Werte und technische Abmessungen. Vermeide das unbeabsichtigte Teilen veränderlicher Daten.

## 3. Gemeinsamer Steuerungsvertrag

Implementiere `ControlInput` mit Gas und Bremse in [0, 1], Lenkung in [−1, 1] und Richtung `forward` oder `reverse`. Lenkbefehl −1 ist links, +1 ist rechts. Begrenze endliche Eingaben, neutralisiere und diagnostiziere NaN sowie Infinity. Ungültige Richtungen dürfen keinen Wechsel auslösen. Bremse hat Vorrang vor Gas. Diese Regeln sind unabhängig von Browser und Eingabequelle.

## 4. Tastatursteuerung

Implementiere WASD und Pfeiltasten. Gasaufbau dauert 0,25 s, Gasabbau 0,12 s, Bremse wirkt unmittelbar. Lenkaufbau dauert 0,25 s, Rückstellung 0,20 s. Gegensätzliche Lenkeingaben ergeben neutral, gleichzeitige Vorwärts- und Rückwärtsbefehle bremsen. Tastatur-Lenkempfindlichkeit ist einstellbar. Ein Richtungswechsel benötigt höchstens 0,05 m/s Gesamtgeschwindigkeit und 0,30 s ununterbrochen gehaltene Gegenrichtung. Berücksichtige Fokusverlust, Alt+Tab, Textfelder und Pause. Verhindere hängenbleibende Tasten und entferne alle Event-Listener.

Trenne das Erfassen der Browserereignisse von der reinen tickbasierten Verarbeitung. Die spätere KI kann dieselbe gemeinsame Schnittstelle headless nutzen. Bereite die Durchsetzung des Richtungsgates für jede Quelle vor. Tatsächliche Beschleunigung, Bremsung und Reifenkräfte folgen in späteren Paketen.

## 5. Architektur und Grenzen

Verwende die vorhandene Mathematik und das 60-Hz-Ticksystem. Trenne Definition, Eingabeverarbeitung, Browseradapter, Physik und Rendering. Bestätigte physikalische Regeln und der bestehende technische Startbildschirm bleiben erhalten. Der Auftrag umfasst keine Fahrzeugphysik, Strecken, Kollisionen, KI, Multiplayer-Funktionen oder endgültige Benutzeroberfläche. Neue externe Abhängigkeiten benötigen Freigabe.

Dokumentiere den Schnittstellenvertrag für FD-003 und FD-004. Markiere mögliche Teilmutationen vor einer Tick-Ausnahme als Integrationsrisiko. Vor der späteren Physikintegration muss die Fehlerbehandlung für fehlgeschlagene Ticks festgelegt werden. Eine Neuentwicklung des FD-001-Cores gehört nicht zum Auftrag.

## 6. Tests

Decke alle FD-002-relevanten VEH- und CTRL-Kriterien ab. Prüfe Nennwerte und Einheiten, ungültige Parameter, unabhängige Instanzen, Steuergrenzen und ungültige Eingaben, beide Tastenschemata, Konflikte, Bremspriorität, Glättung bei festen Ticks, Richtungswechsel samt Haltedauer und Seitenbewegung, Fokusverlust und Pause, Textfelder, Listener-Freigabe sowie Unabhängigkeit von Rendering. Führe die unveränderten FD-001-Tests mit aus. Kennzeichne Physik- und Integrationsprüfungen als ausstehend und führe `npm run check` vollständig aus.

## 7. Dokumentation und Abschluss

Aktualisiere relevante Projektdokumentation, Entwicklungsprotokoll und Aufgabenstatus. Lege diese Auftragsfassung unter `docs/first-drive/FD-002_CODEX_PROMPT.md` ab. Berichte auf Deutsch über Funktionen, Dateien, Schnittstellen und Daten, tatsächliche Prüfungen und Ergebnisse, technische Entscheidungen, offene Kriterien, bekannte Probleme und die für das Entwicklerreview relevanten Zusammenhänge. Zeige Git-Status und Zusammenfassung der Änderungen.

Führe keine automatischen Commits, Pushes oder Merges aus. Beginne FD-003 nicht und beende die Arbeit nach Fertigstellung und Prüfung von FD-002.
