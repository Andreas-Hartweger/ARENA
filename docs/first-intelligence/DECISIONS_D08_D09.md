# Bestätigte Entscheidungen D08/D09

85 Entscheidungen; technische Umsetzung siehe Spezifikationen.

| ID       | Auswahl | Thema                     | Festlegung                                                                                           |
| -------- | ------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| D08.1.1  | D       | Wahrnehmungsprofile       | Modular; hybrides Standardprofil zuerst; weitere Profile später.                                     |
| D08.1.2  | B       | Weltwissen                | Nur lokale fahrerbezogene, sichtbare Informationen; kein absolutes Weltwissen.                       |
| D08.1.3  | B       | Eigenbewegung             | Tempo, längs/quer, Gierrate, tatsächlicher Lenkwinkel, Fahrtrichtung.                                |
| D08.1.4  | C       | Untergrund/Grip           | Material und verfügbarer Reibwert je Achse.                                                          |
| D08.1.5  | C       | Streckenvorschau          | Lokale Orientierung und begrenzte sichtbare Vorschau; keine ideale Linie.                            |
| D08.1.6  | B       | Gegner                    | Schnittstelle vorbereiten; unabhängige Kandidaten unsichtbar.                                        |
| D08.1.7  | C       | Realismus                 | Exakte deterministische Standardmessungen; Störungen später.                                         |
| D08.1.8  | B       | Profile                   | Datenbasiert, versioniert und kompatibilitätsgeprüft.                                                |
| D08.2.1  | D       | Sensortyp                 | Einzelstrahlen zuerst; modulare Erweiterung für Kamera, Radar, LiDAR.                                |
| D08.2.2  | C       | Front-/Seitensensoren     | 13 Strahlen; später höhere Auflösung.                                                                |
| D08.2.3  | B       | Frontsicht                | 180 Grad; langfristig Rundumwahrnehmung.                                                             |
| D08.2.4  | B       | Winkelverteilung          | Dichter vorne; feste Winkel im Profil.                                                               |
| D08.2.5  | C       | Hecksensoren              | 3 Strahlen; später detaillierter.                                                                    |
| D08.2.6  | D       | Ursprünge                 | Individuelle lokale Position pro Sensor.                                                             |
| D08.2.7  | D       | Reichweite                | Max. 150 m vorne; keine Sicht durch Hindernisse.                                                     |
| D08.2.8  | C       | Einzelreichweiten         | Fest je Sensor; später sensortypabhängig.                                                            |
| D08.3.1  | C       | Objektklassen             | Erweiterbar; Asphaltgrenze, Barriere, Fahrzeug.                                                      |
| D08.3.2  | C       | Messkanäle                | Getrennte Distanz-/Gültigkeitskanäle.                                                                |
| D08.3.3  | C       | Verdeckung                | 2D blickdichte Geometrie zuerst; später sensortypabhängig.                                           |
| D08.3.4  | C       | Vorschauinhalt            | Sichtbare Punkte, Richtung und Krümmung; keine verdeckten Daten.                                     |
| D08.3.5  | C       | Vorschauabstände          | 7 Punkte: 5, 10, 20, 40, 60, 100, 150 m.                                                             |
| D08.3.6  | B       | Andere Streckenabschnitte | Alles tatsächlich Sichtbare; keine geheime Route. Abkürzungen physisch möglich, Wertung gemäß Toren. |
| D08.3.7  | C       | Gegnerdaten               | Relative Position, Bewegung, Ausrichtung, Distanz nur erkannter Fahrzeuge.                           |
| D08.3.8  | C       | Material                  | Sichtbare Übergänge und Materialtypen; keine zukünftige exakte Gripkarte.                            |
| D08.3.9  | C       | Gültigkeit                | Separates Gültigkeitssignal je Messgruppe.                                                           |
| D08.4.1  | E       | Sensorfrequenz            | Konfigurierbar; Standard 30 Hz, simulierte Zeit.                                                     |
| D08.4.2  | C       | Synchronisierung          | Gemeinsamer unveränderlicher Ausgangszustand; Zeitstempel, spätere Verzögerungen.                    |
| D08.4.3  | D       | Koordinaten               | Distanzen, lokale x/y, sin/cos für Richtungen; kein Weltkoordinateninput.                            |
| D08.4.4  | C       | Skalierung                | Fest je Bedeutung, positiv 0..1 oder vorzeichenbehaftet -1..1.                                       |
| D08.4.5  | D       | Kodierung                 | Semantische Kanäle und One-Hot-Material.                                                             |
| D08.4.6  | B       | Eingabeschema             | Versioniert und fest pro Modell.                                                                     |
| D08.4.7  | D       | Präzision                 | Float64-Referenz; optionale spätere Leistungsprofile.                                                |
| D08.4.8  | C       | Suche                     | Exakte Referenz und optimierte Suche; Gleichwertigkeit testen.                                       |
| D08.5.1  | B       | Standardgeometrie         | Abgestufte Winkel, Positionen, Reichweiten gemäß SENSOR_SYSTEM_SPEC.                                 |
| D08.5.2  | B       | Sichtprüfung              | Adaptive konservative Geometrie; zusammenhängende sichtbare Vorschau.                                |
| D08.5.3  | B       | Objektplätze              | Feste Plätze, getrennt von Strahlen; 4 in D09.2 bestätigt.                                           |
| D08.5.4  | B       | Konfiguration             | Entwicklerprofile; später Spielerauswahl/Editor.                                                     |
| D08.5.5  | C       | Sensor Inspector          | Rohwerte, normalisierte Werte, Treffer, Zeitpunkt, Profil, Befehle.                                  |
| D08.5.6  | B       | Erweiterungen             | Modulare Schnittstellen; keine Kamera/Radar/Störungen in 02A.                                        |
| D08.5.7  | C       | Abnahme                   | Referenz-, Regression-, Sichtschutztests und Benchmarks.                                             |
| D09.1.1  | D       | Netzwerktyp               | Modulare Modellschnittstelle; MLP zuerst.                                                            |
| D09.1.2  | D       | Gedächtnis                | Kein internes Gedächtnis; später Historie/rekurrente Modelle.                                        |
| D09.1.3  | D       | Struktur                  | Konfigurierbar, pro Population fest; Strukturevolution später.                                       |
| D09.1.4  | D       | Gehirnaufteilung          | Ein gemeinsames MLP; spezialisierte Module später.                                                   |
| D09.1.5  | D       | Fahrprinzip               | Direkte Steuerung; Trajektorienplanung später.                                                       |
| D09.1.6  | D       | Fahrzeugkompatibilität    | GT-01 zuerst; universelle Modelle und unbekannte Fahrzeuge später.                                   |
| D09.1.7  | C       | Entscheidungen            | Deterministisch; probabilistische Strategien später.                                                 |
| D09.1.8  | C       | Fahrhilfen                | Keine heimliche Korrektur schlechter Fahrentscheidungen; explizite Assistenz später.                 |
| D09.2.1  | A       | Eigenzustand              | 12 Eingaben.                                                                                         |
| D09.2.2  | B       | Strahlen                  | 9 Eingaben je Strahl = 144.                                                                          |
| D09.2.3  | A       | Lokale Orientierung       | 4 Eingaben.                                                                                          |
| D09.2.4  | C       | Vorschaupunkte            | 8 Eingaben je Punkt = 56; getrennte Gültigkeit.                                                      |
| D09.2.5  | A       | Objektplätze              | 4 Plätze.                                                                                            |
| D09.2.6  | B       | Objektfelder              | 8 Eingaben je Platz = 32.                                                                            |
| D09.2.7  | B       | Normalisierung            | Feste Referenzen mit Reserven; siehe Kanalregister.                                                  |
| D09.2.8  | A       | Fehlende Werte            | Wert und Maske 0; Fehler nicht als fehlend maskieren.                                                |
| D09.2.9  | A       | Reserve                   | Nur bestätigte Eingaben; insgesamt 248.                                                              |
| D09.2.10 | C       | Kanalregister             | Versionierte geordnete Felder und Kompatibilitätssignatur.                                           |
| D09.3.1  | B       | Standardgröße             | 248 → 32 → 16 → 3 (Ausgaben in D09.4).                                                               |
| D09.3.2  | B       | Architekturgrenzen        | 1–4 Hidden Layers, 4–128 Neuronen, max. 100.000 Parameter.                                           |
| D09.3.3  | C       | Verbindungen              | Vollständig verbunden; flexible Strukturen später.                                                   |
| D09.3.4  | D       | Aktivierung               | Tanh Standard; ReLU und Leaky ReLU unterstützt.                                                      |
| D09.3.5  | C       | Output                    | Linear; separater Steuerungsadapter.                                                                 |
| D09.3.6  | D       | Initialisierung           | Seed-basiert Glorot/He passend zur Aktivierung.                                                      |
| D09.3.7  | B       | Bias                      | Initial null, trainierbar.                                                                           |
| D09.3.8  | C       | Parameter                 | Zusammenhängender versionierter Float64-Vektor.                                                      |
| D09.3.9  | C       | Kern                      | Eigener präziser TypeScript-Kern, deterministisch, validiert.                                        |
| D09.4.1  | B       | Ausgaben                  | 3: Pedal, Lenkung, Richtung.                                                                         |
| D09.4.2  | B       | Adapter                   | Tanh je Rohwert; Pedal positiv Gas, negativ Bremse.                                                  |
| D09.4.3  | A       | Neutralbereich            | Kein zusätzlicher Neutralbereich für Pedal/Lenkung.                                                  |
| D09.4.4  | B       | Richtung                  | Schwellen ±0,5; sonst Anforderung halten; Start vorwärts.                                            |
| D09.4.5  | A       | Wechsel                   | Gemeinsame bestehende Wechselregeln, 0,05 m/s, 18 Ticks.                                             |
| D09.4.6  | E       | Entscheidungsrate         | Konfigurierbar, Standard 30 Hz synchron.                                                             |
| D09.4.7  | B       | Steuercharakteristik      | Gleiche effektive Grenzen wie Tastatur; keine doppelte Glättung.                                     |
| D09.4.8  | B       | Reset                     | Vollständiger Reset von Cache, Befehlen und Adaptern; Pause erhält Zustand.                          |
| D09.4.9  | D       | Recovery                  | Selbst rangieren; keine Teleporthilfe im normalen KI-Lauf; Spezialtraining später.                   |
| D09.4.10 | C       | Fehler                    | Kontrollierter Stopp, Diagnose und atomarer Zustand.                                                 |
| D09.5.1  | B       | Integration               | Headless und sichtbarer interner KI-Testmodus.                                                       |
| D09.5.2  | B       | Modell/Instanz            | Unveränderliche gemeinsame Modellparameter, getrennte Fahrerzustände.                                |
| D09.5.3  | C       | Brain Inspector           | Interaktiv: Schichten/Neuronen, Aktivierungen, Summen, Bias, Gewichte.                               |
| D09.5.4  | C       | Diagnosezeit              | Synchronisiert, Pause, Einzeltick und konkrete Entscheidung untersuchen.                             |
| D09.5.5  | B       | Testmodelle               | Mathematische Fixtures und Seed-Modelle; kein trainierter Fahrer behaupten.                          |
| D09.5.6  | C       | Validierung               | Referenz- und Regressionstests, Isolation, Sichtschutz, atomare Fehler.                              |
| D09.5.7  | C       | Benchmark                 | Sensor/MLP/Welt separat, Größen, Frequenzen, Instanzen, Diagnose.                                    |
| D09.5.8  | C       | Abschluss                 | Autonomer technischer Abschluss, Queue; menschliches Review/Merge separat.                           |

## Zukunftsziele (nicht freigegebene Implementierung)

| Bereich  | Idee                          | Inhalt                                                                                                                                                                     |
| -------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP       | Advanced Perception           | Kamera- und Tesla-ähnliche Ansätze, Radar, LiDAR, Ultraschall; Positionen, Anzahl, Auflösung, FOV, Reichweite, Störungen, Fusion, 360°-Sicht; eigene ausführliche Planung. |
| AP       | Sensor Studio                 | Editor, Profilwahl, automatische Optimierung, Experimente ohne Vorschau oder mit Navigation; kompatible Modelle bzw. Retraining.                                           |
| AI       | Advanced Brain                | Gedächtnis, Attention, flexible Objektlisten, CNN/GRU/LSTM/Transformer, spezialisierte Netze, NEAT/Strukturevolution; nach Benchmarks.                                     |
| AI       | Universal AI                  | Unbekannte Fahrzeuge und Strecken; Fahrzeugparameter, Domain Randomization, Holdout-Tests, Transfer Learning, Anpassung; keine Garantie für beliebige Konstruktionen.      |
| AI       | Predictive Intelligence       | Bremswege, Grip, Kräfte, TTC, Trajektorien, World Models, modellprädiktive/hybride Verfahren; nur erlaubte Wahrnehmung.                                                    |
| AI       | AI Analytics / Brain Surgery  | Historie, Modellvergleiche, Sensorwichtigkeit, Neuronen/Gewichte editieren, Time Machine, Training live.                                                                   |
| D16+     | Difficulty                    | Einsteiger bis sehr starke Fahrer, trainierte Profile/Checkpoints, adaptive Schwierigkeit, Fahrstil separat; keine versteckten Physikvorteile.                             |
| D20      | Minikarte                     | First-Launch-Kandidat: eigene/andere Position, Streckenübersicht, Follow; spätere Heatmaps. Nur Spielerinformation.                                                        |
| 06/10/12 | Road Physics                  | Asphaltmischungen, Rauigkeit, Bodenwellen, Schlaglöcher, Curbs, Neigung, Wetter, Reifen/Fahrwerk; spätere Physikplanung.                                                   |
| AI       | Recovery & Autonomous Driving | Rangieren, Einparken, Verkehr, Überholen, Navigation und spezialisierte Trainingsszenarien.                                                                                |
| AI       | Performance                   | Float32/SIMD/Worker/GPU gegen Referenz und reale Lernbenchmarks; keine vorzeitige Abhängigkeit.                                                                            |
