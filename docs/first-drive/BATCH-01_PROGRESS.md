# Development Batch 01

Basis main 3b85cad, Recovery 97786cc. Arbeitsbaum sauber, Remote-main direkt geprüft. 108 Tests in 14 Dateien, Typprüfungen, ESLint, Prettier, Build und Kalibrierung erfolgreich. Geradeauswerte 3,816667 s, 248,341174 km/h, 31,174882 m, 2,283333 s und 29,675641 km/h rückwärts. Bekannte Bundlewarnung 753 kB.

| Paket  | Status              | Abhängigkeiten         | Nächster Schritt                              |
| ------ | ------------------- | ---------------------- | --------------------------------------------- |
| FD-004 | Automatisch geprüft | FD-003                 | Geometrie, Tore und sichere Positionen prüfen |
| FD-005 | Geplant             | FD-004                 | Kontaktauflösung und Welttransaktion          |
| FD-006 | Geplant             | FD-004/005             | Ansicht, Steuerung, HUD und Browser           |
| FD-007 | Geplant             | alle vorherigen Pakete | Gesamtabnahme und PR                          |

Commit- und Push-Nachweise werden nach den Paketprüfungen ergänzt. Gegenseitiges Review und G-07 stehen aus.

## FD-004

Analytische Academy-Segmente, Offsets, geschlossene Barrieren, Achsoberflächen, lokale Projektion, Gitter/Recovery und gerichtete Rundenwertung in src/tracks. Acht TRK-Fixtures in tests/tracks, zwei vollständige synthetische Runden und echte FD-003-Achsabfrage. Im ersten Test war die äußerste Bogensehne 1,399 m lang. Der Schritt berücksichtigt jetzt den größten Offsetradius. Alle acht gezielten Tests und der vollständige Qualitätslauf mit 116 Tests bestanden. Annahmen: konservative Belegungshülle bei Recovery, außerhalb des Auslaufs ungültige Runde, Sprünge explizit invalidieren. Commit und Remote-Nachweis folgen im nächsten Protokolleintrag. Nächster Schritt gemeinsam verarbeitete Kontakte und tatsächliche Bewegungspfade.

## FD-005

FD-004 ist auf GitHub gesichert. Der Remote-Ref ergab 46666e794fc020a487dd3336dc239cc9f9849ea2. Der GitHub-Connector meldete beim Erstellen des Entwurfs-PR HTTP 403 („Resource not accessible by integration“), gh ist nicht installiert. Die Git-Authentifizierung funktioniert für Branch-Sicherungen.

FD-005 implementiert SAT für konvexe Vierecke, konservative Swept-Hüllen, getrennte Normal-/Reibimpulse mit Hebelarmen, Bewegungsteilschritte und sechs Kontaktiterationen in src/collision. Die Welt in src/game berechnet neue Fahrer-, Kontakt- und Rundenzustände vor einer gemeinsamen Veröffentlichung. Der gemeinsame FD-003-Vorbereitungsschritt erhält beide bisherigen Inputpfade. Korrekturbewegungen erhalten keine Torgutschrift. Die letzten sicheren Posen werden alle 15 Ticks auf Asphalt gesammelt. Der diagnostizierte Fallback stoppt die Körper am Ende des letzten akzeptierten Teilschritts, wenn 32 Teilschritte oder die Kontaktauflösung nicht ausreichen. Das ist keine allgemeine CCD-Garantie.

Acht gezielte Tests einschließlich 2-cm-Wand mit 250 km/h, Gegenverkehr, Restüberlappung, Impulsenergie, Mehrfachkontakt, unabhängigen Kandidaten und Fehler in der zweiten Fahrzeugberechnung bestanden. Im Selbstreview wurde die Rücknahme von Ereignissen aus verworfenen Bewegungsteilschritten ergänzt. Nächster Schritt: Weltframes an die First-Drive-Darstellung anbinden.

FD-005 hat den Status **Automatisch geprüft**. Vollständiger Check 124/124 in 16 Dateien. Die separate FD-003-Kalibrierung reproduziert alle fünf Messwerte. Commit und Remote-SHA folgen nach Sicherung.

## FD-006

FD-005 ist auf GitHub gesichert (Remote- und lokaler SHA 3c2cdf569f0e671e42b2ec9b48466ea09313991c). FD-006 ist **Automatisch geprüft**. App, CSS und index.html verbinden die Tastatur, Uhr, Weltsimulation und Drei-Kamera-Ansicht. src/rendering enthält GT-01, Streckenmesh, Kameramathematik, Diagnosegeometrie, Lebenszyklus und das auf 10 Hz begrenzte HUD. tests/rendering prüft die vier Achsenrichtungen, Zoom/Fit, Vorausschau und Erzeugung der Streckengeometrie. Der vollständige Check bestand mit 127 Tests in 17 Dateien.

Produktions-Preview und tatsächlicher Headless-Chrome: Gas bis 55 km/h, Bremse auf 29 km/h, Rechtskurve, Gras an beiden Achsen und Abbremsen an der inneren Begrenzung. R setzte auf Asphalt und 0 km/h zurück. Esc hielt Tick 3768 fest. C und V wählten Frei bzw. Übersicht. Die Uhr startete an der Startlinie. Screenshotkontrolle von Follow, Übersicht und schmalem Fenster. Ein 404 für favicon.ico wurde durch eine lokale Data-URL behoben. Vollständige Browser-Runden und menschlicher Fahrtest sind offen. Nach Sicherung folgt FD-007 mit Zeitbasis, Mehrfahrzeugregression, Offline-/Performanceprüfung und Bericht.
