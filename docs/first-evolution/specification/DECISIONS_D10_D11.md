# D10/D11 – 103 bestätigte Entscheidungen

Produktentscheidungen am 26.11.2026 bestätigt. Technische Präzisierungen TF-B im jeweiligen Vertrag; keine späteren Features freigegeben.

| ID | Wahl | Bereich | Thema | Festlegung |
|---|---|---|---|---|
| D10.1.1 | D | Grundlagen | Modulare Fitness | Hierarchische skalare Fitness und Komponenten; später Mehrzieloptimierung. |
| D10.1.2 | C | Grundlagen | Lernziel | Gültiger Fortschritt und vollständige Aufgaben/Runden zuerst. |
| D10.1.3 | C | Grundlagen | Belohnung | Kontinuierlicher neuer gültiger Fortschritt und besondere Erfolgssignale. |
| D10.1.4 | D | Grundlagen | Fehler | Abgestufte Konsequenzen; Physik, Fitness und spätere Rennstrafen getrennt. |
| D10.1.5 | C | Grundlagen | Profile | Vordefinierte und eigene Profile; innerhalb vergleichbarer Segmente unverändert. |
| D10.1.6 | D | Grundlagen | Lernbedingungen | Fester vergleichbarer Standard; Curriculum später. |
| D10.1.7 | D | Grundlagen | Aggregation | Einzelversuche und konfigurierbare Szenariogruppen; Robustheit und Holdouts später. |
| D10.1.8 | C | Grundlagen | Diagnose | Komponenten, Anti-Exploit-Tests; privilegierte Bewertungsdaten nicht im KI-Input. |
| D10.2.1 | C | Fortschritt | Streckenfortschritt | Kontinuierlich und checkpointgesichert, nur tatsächliche zulässige Bewegung. |
| D10.2.2 | B | Fortschritt | Startanfahrt | Separat begrenzter Anfahrtsfortschritt; erste Startüberfahrt öffnet Runde. |
| D10.2.3 | C | Fortschritt | Höchstfortschritt | Nur neuer gültiger Höchstfortschritt; Rangieren separat messen. |
| D10.2.4 | B | Fortschritt | Checkpoints | Kleine einmalige Boni pro gültigem Aufgabenabschnitt. |
| D10.2.5 | C | Fortschritt | Runden | Strenge Rundenvalidierung; rechtmäßigen Teilfortschritt bei Invalidierung erhalten. |
| D10.2.6 | C | Fortschritt | Geschwindigkeit | Produktive Geschwindigkeit und Rohtelemetrie getrennt. |
| D10.2.7 | D | Fortschritt | Rundenzeit | Aufgabenbezogene Gesamtleistung und separate Rundenstatistiken. |
| D10.2.8 | B | Fortschritt | Streckenlimits | Bestehende Validierung, abgestufte Folgen; Gras nicht pauschal ungültig. |
| D10.2.9 | C | Fortschritt | Vergleich | Rohdaten und aufgabenbezogene Normalisierung; keine Gleichsetzung verschiedener Schwierigkeit. |
| D10.3.1 | C | Belohnung und Strafen | Kollisionen | Stärke, Dauer und wiederholte Ereignisse getrennt erfassen. |
| D10.3.2 | C | Belohnung und Strafen | Gras | Nach Dauer und betroffenen Achsen bewerten. |
| D10.3.3 | C | Belohnung und Strafen | Stillstand | Unproduktiven Stillstand nach Toleranz bewerten. |
| D10.3.4 | C | Belohnung und Strafen | Fahrtrichtung | Rangieren und falsche Streckenrichtung getrennt erfassen. |
| D10.3.5 | C | Belohnung und Strafen | Kontrollverlust | Nur deutlich unkontrollierte Bewegungen zusätzlich bewerten. |
| D10.3.6 | C | Belohnung und Strafen | Steuerung | Geringe optionale Bewertung unnötig hektischer Befehle. |
| D10.3.7 | C | Belohnung und Strafen | Recovery | Diagnose; primär neuen Fortschritt belohnen, kein farmbarer Bonus. |
| D10.3.8 | D | Belohnung und Strafen | Kurven | Ergebnisorientierung; physikalische Referenzmodelle später. |
| D10.3.9 | C | Belohnung und Strafen | Exploits | Gültigkeitsregeln, Exploit-Prüfungen, getrennte Fehlerdiagnose. |
| D10.3.10 | C | Belohnung und Strafen | Hierarchie | Aufgabenerfolg mit begrenzten Zusatzbewertungen. |
| D10.4.1 | D | Episoden | Rundenzahl | Konfigurierbare Aufgabe; Standard eine gültige Runde. |
| D10.4.2 | D | Episoden | Zeitlimit | Konfigurierbar; Standard 120 simulierte Sekunden. |
| D10.4.3 | C | Episoden | Fortschrittsfrist | 5 s Startschonfrist, danach 15 s ohne 2 m neuen gültigen Höchstfortschritt. |
| D10.4.4 | D | Episoden | Kollisionen | Aufgabenabhängig; Standard keine sofortige Beendigung durch Kollision. |
| D10.4.5 | B | Episoden | Recovery | Innerhalb normaler Fortschrittsfrist; keine erneute Frist durch Kontakt. |
| D10.4.6 | D | Episoden | Erfolg | Sofortiger Abschluss nach Ziel; separate Validierungsaufgaben. |
| D10.4.7 | D | Episoden | Start | Deterministischer Academy/GT-01-Start; gemeinsame Variationen später. |
| D10.4.8 | D | Episoden | Fehler | Abschlussgründe und kontrollierte Kandidatenisolation. |
| D10.5.1 | C | Fitnessprofile | Umfang | Balanced, Speed, Safety, validiertes Custom; erweiterbare Architektur. |
| D10.5.2 | C | Fitnessprofile | Balanced | Fortschrittsorientiert, ausgewogene Rennleistung. |
| D10.5.3 | B | Fitnessprofile | Speed | Starker Zeitfokus, begrenzte Sicherheitsstrafen. |
| D10.5.4 | C | Fitnessprofile | Safety | Starke Sicherheitsbewertung; spätere verbindliche Sicherheitsgrenzen. |
| D10.5.5 | D | Fitnessprofile | Taktik | Spezialisierte Aggressive/Defensive bei Mehrfahrzeugtraining; später kombinierte Taktik. |
| D10.5.6 | D | Fitnessprofile | Adaptability | Erfolg, Mittelwert, Robustheit; später intelligentes Curriculum. |
| D10.5.7 | C | Fitnessprofile | Custom | Detaillierte versionierte validierte Gewichte; geschützte Kernregeln. |
| D10.5.8 | D | Fitnessprofile | Profilwechsel | Vergleichbarer Abschnitt unveränderlich; später kontrollierte Wechsel/Neubewertung. |
| D10.6.1 | B | Mathematik | Gesamtfitness | F=1100*((N+1)*S+L)+R; 0<=R<=1000. |
| D10.6.2 | B | Mathematik | Detailfitness | R=900P+10A+15K+75PQ; Fortschritt, Startanfahrt, Zwischencheckpoints, Qualität. |
| D10.6.3 | B | Mathematik | Zeit | Erfolg T=clamp(1-t/limit); bei unvollständig T=P; Rohgeschwindigkeit separat. |
| D10.6.4 | B | Mathematik | Kollision/Gras | 0,05+0,45*min(1,vn/15)^2 je Ereignis; 0,01/s Kontakt; 0,25 s kontaktfrei; Gras gewichtete Sekunden/20; clamp. |
| D10.6.5 | B | Mathematik | Weitere Strafen | Stillstand <0,5 m/s >3 s; falsche Richtung >1 m/s >2 s; Instabilität >=5 m/s, Slip >35°, produktiver Anteil <25 %, >0,5 s; je 10 s; Steueraktivität >4 je 1 s in 2 aufeinanderfolgenden Fenstern; 10 Fenster. |
| D10.6.6 | B | Mathematik | Gewichte | Balanced 50/25/8/7/4/6/0; Speed 80/10/2/3/2/3/0; Safety 15/45/15/5/7/10/3; Custom nichtnegativ, positive Summe. |
| D10.6.7 | C | Mathematik | Abnahme | Referenzen, Grenzwerte, Exploits, Reproduzierbarkeit und Diagnosen. |
| D11.1.1 | D | Lernverfahren | Algorithmus | Modularer generationsbasierter genetischer Algorithmus. |
| D11.1.2 | D | Lernverfahren | Genom | Direkter Float64-Vektor mit versionierter Modellzuordnung, unabhängige Kopien. |
| D11.1.3 | D | Lernverfahren | Nachkommen | Mutationsorientiert, optionale Kreuzung, unveränderte Eliten. |
| D11.1.4 | C | Lernverfahren | Architektur | Austauschbare Auswerter, getrennte Fitness und Simulation. |
| D11.1.5 | C | Lernverfahren | Startwissen | From Scratch und kompatible Ausgangsmodelle getrennt; erster Lernnachweis ohne Vortraining. |
| D11.1.6 | C | Lernverfahren | Feedback | Gesamtfitness und Komponenten; spätere Verhaltensmerkmale nur diagnostisch. |
| D11.1.7 | D | Lernverfahren | Erweiterung | Erweiterbare Optimierung und eigene Forschungsroadmap. |
| D11.1.8 | D | Lernverfahren | Lernnachweis | Mehrere Seeds, Baselines, Auswertungsbudget, Rechenzeit und unabhängige Validierung. |
| D11.2.1 | E | Population | Größe | 8–1024 ganzzahlig; Standard 128. |
| D11.2.2 | D | Population | From Scratch | Unabhängige D09-Initialisierung je Kandidat, deterministische Seeds. |
| D11.2.3 | D | Population | Seeded Start | Ein exaktes Ausgangsmodell, 25 % Zufallsmodelle, Rest mutierte Kopien; konfigurierbar. |
| D11.2.4 | D | Population | Identität | Trainings-, Individuum-, Genom- und Auswertungsidentität, direkte Eltern, Entstehung, Prüfsumme. |
| D11.2.5 | D | Population | Auswertung | Deterministischer Referenzauswerter, spätere skalierbare Ausführung. |
| D11.2.6 | D | Population | Generationsgrenze | Vollständig, atomar, Eliten erneut auswerten. |
| D11.2.7 | D | Population | Budget | Konfigurierbar; Standardtest 100 ausgewertete Generationen G0–G99, 12800 Auswertungen. |
| D11.2.8 | D | Population | Champion | Generationsbestes und Trainingschampion getrennt; Archiv/Validierung separat. |
| D11.2.9 | D | Population | Datenhaltung | Kompakte individuelle Ergebnisse/Abstammung, aktuelle Population/Champions; selektive Traces. |
| D11.3.1 | E | Selektion | Verfahren | Modular; Tournament Selection als Standard. |
| D11.3.2 | D | Selektion | Turnier | 2–8, Standard 3, ohne Zurücklegen innerhalb Turnier; reduzierte Elternmenge effektiv kleiner. |
| D11.3.3 | D | Selektion | Elite | 1–20 %, Standard 5 %, round, mindestens 1 und mindestens 1 freier Platz. |
| D11.3.4 | D | Selektion | Elternpool | 25–100 %, Standard 100 % gültig bewertete Kandidaten. |
| D11.3.5 | C | Selektion | Zweiter Elternteil | Anderer kompatibler Genominhalt; sonst Einzel-Eltern-Mutation. |
| D11.3.6 | C | Selektion | Crossover | Uniform 50/50 pro Parameter; neuronweise 50/50 pro Neuron inkl. Bias. |
| D11.3.7 | D | Selektion | Wahrscheinlichkeit | 0–100 %, Standard 0; Vergleich 10 % neuronweise; danach normale Mutation. |
| D11.3.8 | C | Selektion | Vielfalt | Unterschiedliche Elitegenome bevorzugen; Duplikate messen, keine unkontrollierten Retry-Mutationen. |
| D11.3.9 | C | Selektion | Gleichstände | Geseedete kanonische Rangfolge bei exakt gleicher Fitness; vollständige Kompatibilität, Kopien. |
| D11.4.1 | C | Mutation | Operator | Additive Gauß-Mutation, deterministisch; modular. |
| D11.4.2 | D | Mutation | Wahrscheinlichkeit | 0–100 %, Standard 5 %, bei positiver effektiver Wahrscheinlichkeit ggf. eine Mindestauswahl. |
| D11.4.3 | D | Mutation | Stärke | Relativ zur Initialisierungs-SD; alpha 0,01–2, Standard 0,20; absolut 0,001–1 als Vergleich. |
| D11.4.4 | C | Mutation | Mischung | Große Mutationen 0–30 %, Standard 5 % der ausgewählten; Multiplikator 1–10, Standard 5. |
| D11.4.5 | D | Mutation | Bias | Standard gleiche Wahrscheinlichkeit/Schichtskala; Faktoren 0–2, Standard 1. |
| D11.4.6 | C | Mutation | Grenzen | Gewichte ±8, Bias ±4, konfigurierbar; clip und Diagnose, importierte Modelle nicht heimlich ändern. |
| D11.4.7 | C | Mutation | Schichten | Wahrscheinlichkeits-/Stärkefaktoren 0–2, Standard 1; mutationsgeschützt bei null. |
| D11.4.8 | C | Mutation | Adaptive Wahrscheinlichkeit | Optional, bei Stagnation Faktor 1,5, Standard 5 % bis 20 %, bei Verbesserung Reset; Referenz aus. |
| D11.4.9 | C | Mutation | Adaptive Stärke | Optional relativ, Faktor 1,5, Standard 0,20 bis 0,80, bei Verbesserung Reset; Referenz aus. |
| D11.4.10 | C | Mutation | Diagnose | Mathematische und statistische Tests, ausgewählt/verändert/clip je Schicht; optionale Details. |
| D11.5.1 | C | Adaptive Evolution | Diversity | Einzigartige Genome, Duplikate und mittlere normierte quadratische Paar-Distanz via Varianz, pro Schicht. |
| D11.5.2 | C | Adaptive Evolution | Stagnation | 15 Generationen ohne >=1 Fitnesspunkt gegenüber Referenz; Fenster 5–100, Schwelle 0,001–100. |
| D11.5.3 | C | Adaptive Evolution | Adaption | Abwechselnd p und alpha erhöhen; Grenzen/Reset; keine Reaktivierung deaktivierter Mutation. |
| D11.5.4 | C | Adaptive Evolution | Immigrants | 0–25 %, Referenz 0, Vergleich 5 %; ersetzen Nachkommen, mindestens einer bleibt. |
| D11.5.5 | C | Adaptive Evolution | Rettung | Optional alle 45 stagnierenden Generationen, Zielquote max(regulär,15 %), einmalige Generation, Elite geschützt. |
| D11.5.6 | C | Adaptive Evolution | Verhaltensvielfalt | Diagnostische Merkmale, spätere Novelty/QD und Archive. |
| D11.5.7 | C | Adaptive Evolution | Holdouts | Training, Validierung und unabhängige Tests getrennt. |
| D11.5.8 | D | Adaptive Evolution | Universal AI | Vielfältige Fahrzeuge/Szenarien, später Fahrzeugdaten, Gedächtnis und dynamische Anpassung. |
| D11.5.9 | D | Adaptive Evolution | Wissenstransfer | Imitation, Transfer, Distillation, Multi-Task, Continual, hybride Modelle; Regression alter Fähigkeiten. |
| D11.5.10 | D | Adaptive Evolution | Forschung | Research Lab, Optimierung Sensorik/Architektur/Lernen/Fitness/Performance; unabhängige Benchmarks. |
| D11.6.1 | C | Technische Abnahme | Module | Typisiert, modular, versioniert; bestehende Physik/Inferenz verwenden. |
| D11.6.2 | D | Technische Abnahme | RNG | Versionierter uint32-Seed-Vertrag, getrennte Streams, Box-Muller, Referenzvektoren, reproduzierbar gleiche Runtime. |
| D11.6.3 | D | Technische Abnahme | Atomarität | Isolation; einmal Retry nur nachweislich temporäre Infrastruktur; sonst Generation blockiert, kein Fake-Score. |
| D11.6.4 | D | Technische Abnahme | Diagnose | Versionierte immutable Snapshots, kompakte Statistiken, optionale Traces; keine Wirkung auf Evolution. |
| D11.6.5 | D | Technische Abnahme | Benchmarks | Komponenten/Gesamt, feste Seeds, Warmup, >=3 Wiederholungen, Populations-/Netzgrößen, Speicher/Regression. |
| D11.6.6 | D | Technische Abnahme | Tests | Mehrstufig, unabhängige Referenzen, Statistik, Exploits, Fehler, Integration, alle 103 verknüpft. |
| D11.6.7 | D | Technische Abnahme | Release Gate | Technischer Abschluss, unabhängiger Review, Branch/PR/CI, Merge separat, 02C nicht automatisch. |

Anmerkungen A: durchgehende spätere Qualitäts-, Performance- und KI-Optimierung; optional grafische Evolution, Population und Gehirnänderungen (D11.2); universelles leistungsfähigstes System mit getrennten Trainingszielen, Schwierigkeitsstufen und Benutzer-KIs (D10.5). Keine weiteren individuellen Abweichungen.
