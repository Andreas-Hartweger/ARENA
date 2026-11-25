# Sensorik – D08 / TF-01–07

## Profil und Geometrie

Standard `arena.perception.standard.v1` (technischer ID-Vorschlag), 30 Hz; lokal x vorne, y links; CCW positiv. Transform origin = ego.position + x*forward + y*left; unit direction = cos(heading+angle), sin(...). Ursprung ab Fahrzeugmittelpunkt, nicht ab Weltursprung. Distanz ab jeweiligem Ursprung. Reihenfolge fixiert:

| ID    | Winkel ° |  x m |    y m | Reichweite m |
| ----- | -------: | ---: | -----: | -----------: |
| ray00 |      -90 |    0 | -0.925 |           75 |
| ray01 |      -60 |  1.9 |   -0.9 |          100 |
| ray02 |      -45 |  1.9 |   -0.9 |          120 |
| ray03 |      -30 |  2.2 |      0 |          120 |
| ray04 |      -20 |  2.2 |      0 |          150 |
| ray05 |      -10 |  2.2 |      0 |          150 |
| ray06 |        0 |  2.2 |      0 |          150 |
| ray07 |       10 |  2.2 |      0 |          150 |
| ray08 |       20 |  2.2 |      0 |          150 |
| ray09 |       30 |  2.2 |      0 |          120 |
| ray10 |       45 |  1.9 |    0.9 |          120 |
| ray11 |       60 |  1.9 |    0.9 |          100 |
| ray12 |       90 |    0 |  0.925 |           75 |
| ray13 |     -135 | -2.2 |   -0.9 |           60 |
| ray14 |      135 | -2.2 |    0.9 |           60 |
| ray15 |      180 | -2.2 |      0 |           60 |

Profilprüfung: eindeutige IDs, endliche Koordinaten/Winkel/Reichweiten, Reichweite >0, Ursprung innerhalb/auf der kompatiblen Fahrzeugkontur, Frequenz positiver ganzzahliger Teiler von 60; Standard exakt diese 16. Datenbasiert, nicht während Evaluation veränderbar. Neues Schema für andere Kanalzahl; keine neuen Sensortypen in 02A. Geometrische Vorschau hat eigenen Referenzursprung (Frontmitte x=2,20, y=0), FOV ±90°, Reichweite 150 m; ab Ego-Mitte beschriebene Punktpositionen. Lokale Orientierung darf nah seitlich/rear erkennbaren Straßenrand verwenden, nicht durch Wände. Dies ist eine idealisierte Sichtgeometrie, keine echte Kamera.

## Raycast

- Statische Barrieren als dieselben geschlossenen 2D-Wall-Polygone (a,b,outerA,outerB) wie Kollision, dynamische Fahrzeuge als tatsächliche OBB. Keine eigene Karosserie. Unabhängige Kandidaten vollständig aus Abfrage/Verdeckung ausschließen; echte gemeinsame Renn-/Testwelt hat Gegner. Bei Start im blickdichten Polygon Treffer bei 0; Tangentialkontakt mit Wand zählt als blickdicht. Reichweitengrenze inkl. Ecken; keine negativen Entfernungen. Kein Treffer = invalid (0/0).
- Straßenrand aus derselben analytischen Track-/SurfaceQuery-Geometrie (Gerade/Arc, tatsächliche Asphalt/Gras-Grenze); die Rendering-Tessellation allein darf nicht zu falschem Materialübergang führen. Erst echten Materialwechsel entlang Ray ermitteln; reine Tangente ohne Wechsel kein Übergang. Material direkt hinter Übergang nur wenn sichtbar und innerhalb Reichweite, sonst beide One-Hot-Felder + Valid 0. Start auf Grenze: materialseitige Proben in deterministischer Richtung; wenn nicht robust auflösbar, invalid statt Schätzung. Keine Gripkarte in Ferne.
- Erster blickdichter Hit bestimmt Sichtgrenze; Edge kann vorher erkannt werden, nicht dahinter. Mehrere sichtbare Kanäle zulässig, sofern keine Verdeckung. Bei geometrischem Gleichstand (Vorschlag 1e-8 m) konservativ Barriere vor Fahrzeug; Grenz-/Materialdaten am Occluder nicht preisgeben, Material nur strikt davor. Stabile interne Reihenfolge bei gleichartigen Treffern; IDs bleiben privat. Geometrische Numerik dokumentieren; nahe Ties nicht mit willkürlicher Objektiterationsreihenfolge entscheiden.
- Referenz prüft sämtliche relevanten geometrischen Primitive; optimierte konservative Broadphase (Raster/BVH/andere gemessene Wahl) darf keinen potenziellen Hit verwerfen, sortiert/narrow-phase wie Referenz. Statische Indexierung einmal pro Track; dynamisch pro Ausgangsframe oder Abfrage. Tests inkl. tangential, parallel, Kollinearität, Ursprung an Kante, Start innen, Reichweite und Randomized-Vergleich. Keine garantierte kontinuierliche Sicht aus wenigen Sample-Rays ableiten.

## Lokale Orientierung und Vorschau

Ziel: idealisiert erkannte Fahrbahnmitte, nicht geheime Rennroute. `track.project(p, lap.s)` und Gate-/Lapdaten sind als Sensorinput verboten. Die interne Geometrie ist erlaubt NUR zur Rekonstruktion tatsächlich sichtbarer Straßenabschnitte. Für Orientierung lokale plausible Kandidaten aus sichtbaren Fahrbahnrändern/Mittellinien bilden; nächstgelegenen eindeutig sichtbaren Abschnitt wählen (lokaler Abstand max. 12 m als konservativer Vorschlagswert, außerhalb invalid). Bei nicht eindeutig unterscheidbaren Kandidaten/Abzweigungen invalid statt globaler Projektionshint. Tangente in Richtung der Fahrzeugausrichtung wählen; Gleichstand bei orthogonaler Ausrichtung oder mehrdeutige Verbindung invalid. Kein Kenntnisgewinn aus vorgeschriebener Rennrichtung. Für positive laterale Abweichung gilt (ego−Mitte)·left(gewählte Tangente).

Vorschau ab lokalem Anker entlang der gewählten sichtbaren, zusammenhängenden Mittellinie in dieser Richtung, Bogenlängen 5,10,20,40,60,100,150 m; Schleifennaht korrekt behandeln. Vorschauprüfung ab Frontmitte mit FOV und Reichweite, blickdichten Barrieren/Gegnern; sowohl Punkt als auch zusammenhängender erkennbarer Fahrbahnabschnitt dazwischen müssen zulässig sein. Kein Überspringen verdeckter Lücken. Geometrische Richtung/Krümmung nur aus sichtbarer lokaler Nachbarschaft; bei Übergang/Sichtgrenze getrennte Masken. An unstetiger Krümmung oder nicht beweisbarer Nachbarschaft invalid. Intern keine vorgeschriebene ideale Linie. Nicht sichtbare, auch wenn im Track-Datensatz vorhanden, niemals ins Netzwerk.

Konservativer technischer Ansatz: analytische Gerade/Arc-Intervalle oder adaptiv unterteilte, konservativ umschließende Bounds; Sicht-FOV-/Reichweitenprüfung und Schnitt der Sichtfächer vom Ursprung mit Occluder-Polygonen. Eine Unterteilung allein ist kein Beweis: akzeptiere Intervalle nur, wenn der gesamte relevante Bereich als sichtbar zertifiziert ist; bei Grenz-/Budgetfall invalid bis Ende der Vorschau. Sichtbare Nachbarschaft für Ableitung separat nachweisen (z.B. maximal 0,5 m links/rechts, bei Segmentgrenze einseitig nur wenn eindeutige Ableitung; keine versteckten Segmente). Exakte Methode B; dokumentierte Tests ohne Lecks verpflichtend. Falls Sichtbarkeitsanforderung nicht sinnvoll erreicht wird, PLANUNGSENTSCHEIDUNG statt stillschweigender Kartenfreigabe.

## Gegner

Erkannt = mindestens ein gültiger Vehicle-Hit eines der 16 Strahlen, als nächster blickdichter Treffer. Nicht alle optisch sichtbaren Fahrzeuge werden durch 16 Rays garantiert erkannt. Liste deduplizieren (interne ID nur intern). Vier Slots sortiert nach Distanz Ego-Mitte zu erkannter OBB-Mitte, dann deterministischer geometrischer Tie-Break (lokales x/y, relative Bewegung, heading; interne stabile ID erst bei identischen ausgegebenen Daten); keine ID an Netzwerk. Objektposition/heading/velocity sind bewusst idealisierte Messwerte eines erkannten Körpers, nicht echte Schätzung. Relative Geschwindigkeit = (v_other−v_ego) auf Ego-Achsen, keine Ableitung rotierender Koordinaten. Slot-Entfernung Mittelpunkte; Ray-Distanz Oberfläche ab Ray-Ursprung. Außerhalb Referenz clamp, keine Gegnerdaten ohne Treffer. Nicht belegte Slots komplett 0. Im unabhängigen Training auch sämtliche ray.vehicle.* = 0. Vollständige Erkennung, Objekttracking und flexible Objektlisten später.

## Eigener Fahrzeugzustand / Grip

Aus unveränderlichem Frame: Geschwindigkeit/Projektionen, Gierrate, tatsächlicher Lenkwinkel geometrisch, eingelegte Richtung. Achsmaterial aus Position/Achsoffset und vorhandener SurfaceQuery; effektiver Reibwert für unmittelbar bevorstehenden Physikschritt mittels reiner `sampleAxles`-Vorschau (keine Mutation/keine Fortschreibung). Nutze `profile.friction`, nicht gripN oder utilization; gleiche Übergangslogik wie Physik, auch initial null/reset. Keine veraltete PhysicsDiagnostics als alleinige Quelle; nach Kontakt/Recovery aktuelle Pose beachten. Keine Änderung der Materialparameter. Bei unbekanntem Material der aktuellen Foundation Fehler statt unbemerkter dritter Klasse.
