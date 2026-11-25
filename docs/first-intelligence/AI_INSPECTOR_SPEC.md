# Sensor und Brain Inspector – TF-16 / D08.5.5 / D09.5.3–4

Interne, standardmäßig geschlossene Diagnose; keine dritte öffentliche UI-Stufe. Später Advanced. Bestehendes F3 kann Einstieg sein (konkrete UX B, keine kollidierenden Tastenkürzel). Bei 390 CSS px nutzbare Ansicht ohne horizontalen Seitenoverflow; große Netzwerkdetails in scrollbaren/selektierbaren Panels.

## Sensor Inspector

- Ego-Profil-ID/Version, Beobachtungstick/Alter, jeweiliger Ursprung, Winkel, MaxRange, sichtbarer Strahlabschnitt, Edge/Barrier/Vehicle-Hit, Material, Gültigkeit, 7 Vorschaupunkte und getrennte Masken, 4 Slots; rohe SI-Werte und tatsächlich an MLP übergebene 248 Werte (Filter/ausgewählter Kanal). Unbekannte Daten als unbekannt; keine unsichtbaren Punkte mit tatsächlicher Position visualisieren, außer klar getrennte privilegierte Entwickleransicht, niemals als KI-Wahrnehmung.
- Renderposition darf interpoliert sein; Strahlen und Treffer auf zugehörigem Messframe darstellen, nicht fälschlich an späterer Position verschieben. Zeige Zeitpunkt/Alter klar.

## Brain Inspector

- Reale Modellarchitektur, Aktivierungen, ausgewählte Verbindungen mit Gewicht/Vorzeichen, Rohsummen z, Bias, Output, daraus p/s/d, Gas/Bremse/Richtung-Anforderung, tatsächlich angewendete Steuerung mit Tick. Keine erfundenen Werte/animierten Demoaktivierungen im fertigen Inspector. Modell-/Profilkennung, Input- und Decision-Tick.
- Gruppierung der 248 Inputs, Layer-Auswahl, Neuron-Auswahl (alle erreichbar), Filter Verbindungen (z.B. ausgewähltes Neuron/top |w|). Gewichtsvorzeichen/Farbe und Aktivierung verständlich getrennt. Nicht alle 8.496 Kanten gleichzeitig erzwingen. Lesende Werte, keine Brain Surgery, keine Historienaufzeichnung aller Frames.
- Live-UI bis 10 Hz, exakt angezeigte publizierte Trace bei Pause/Step. Zeige „noch keine Entscheidung“ oder alte Entscheidung mit Alter, wenn kein neuer Trace vorliegt. Beim Öffnen ggf. bis nächste echte Entscheidung warten; keine zweite Inference nur für Anzeige, keine Änderung der Entscheidungsfolge. Einzeltick exakt ein Physiktick, Entscheidung nur wenn fällig. Pause/Resume/Reset konsistent. Kein Debug-Trace in geschlossenem Modus, außer minimale für Simulation ohnehin nötige Werte. Headless standardmäßig ohne UI/Trace.
- Diagnose darf weder RNG noch Cache, Modellgewichte, Fahrzeugzustand oder Ergebnisse verändern; Vergleich gleiche Seeds/Frames mit Inspector an/aus. Wenn Snapshot-Kopien, nur owned Daten. Lifecycle dispose, Eventhandler/RAF prüfen, kein Leck.

## Kleine HUD-Korrekturen (PRE-03)

Recovery-Hinweis nach 180 simulierten Ticks seit akzeptiertem Recovery ausblenden; Pausenzeit zählt nicht; neue Aktion erneuert Frist. F3 Label „Grip-Auslastung“ plus verfügbare Kraft pro Achse in N, klar von μ getrennt. Anzeigeänderungen ohne Änderung der Kräfte, Steuerung oder Fortschrittswertung. Feedback „war nicht schön“ als offene spätere Fahrgefühl-Aufgabe; kein Retuning ohne Ziel/Freigabe.
