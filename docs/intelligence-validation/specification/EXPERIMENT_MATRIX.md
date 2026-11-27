# Forschungskatalog
47 Screeningvarianten; 122 nominale Läufe; 1.512.448 reguläre Episoden. `experiments.csv` listet jede Run-ID; `research_config.json` enthält vollständige Baseline und Variantendeltas. Confirm/Long Slots werden vor Start mit ausgewählter Konfiguration und daraus berechneter vollständiger Generationszahl eingefroren. Feldnamen sind Plan-DTO, keine Behauptung bestehender API. Adapter mappt tatsächliche D11/02C Felder und Enum-Namen.

| ID | Gruppe | Delta |
| --- | --- | --- |
| S01 | Population | {"population": 32} |
| S02 | Population | {"population": 64} |
| S03 | Population | {"population": 256} |
| S04 | Population | {"population": 512} |
| S05 | Turnier | {"tournament": 2} |
| S06 | Turnier | {"tournament": 5} |
| S07 | Turnier | {"tournament": 8} |
| S08 | Eliten | {"eliteRate": 0.01} |
| S09 | Eliten | {"eliteRate": 0.02} |
| S10 | Eliten | {"eliteRate": 0.1} |
| S11 | Eliten | {"eliteRate": 0.2} |
| S12 | Elternpool | {"parentPool": 0.25} |
| S13 | Elternpool | {"parentPool": 0.5} |
| S14 | Mutation p | {"mutationProbability": 0.01} |
| S15 | Mutation p | {"mutationProbability": 0.02} |
| S16 | Mutation p | {"mutationProbability": 0.1} |
| S17 | Mutation p | {"mutationProbability": 0.2} |
| S18 | Mutation alpha | {"mutationAlpha": 0.05} |
| S19 | Mutation alpha | {"mutationAlpha": 0.1} |
| S20 | Mutation alpha | {"mutationAlpha": 0.4} |
| S21 | Mutation alpha | {"mutationAlpha": 0.8} |
| S22 | Crossover | {"crossoverProbability": 0.1, "crossoverOperator": "uniform"} |
| S23 | Crossover | {"crossoverProbability": 0.1, "crossoverOperator": "neuron-wise"} |
| S24 | Adaption | {"adaptProbability": true, "adaptStrength": false} |
| S25 | Adaption | {"adaptProbability": false, "adaptStrength": true} |
| S26 | Adaption | {"adaptProbability": true, "adaptStrength": true} |
| S27 | Immigrants | {"immigrantRate": 0.05} |
| S28 | Immigrants | {"immigrantRate": 0.1} |
| S29 | Rescue | {"rescueEnabled": true} |
| S30 | Large mutation | {"largeProbability": 0} |
| S31 | Large mutation | {"largeProbability": 0.1} |
| S32 | Large mutation | {"largeProbability": 0.2} |
| S33 | Größe | {"hidden": [16, 8]} |
| S34 | Größe | {"hidden": [32, 32]} |
| S35 | Größe | {"hidden": [64, 32]} |
| S36 | Größe | {"hidden": [128, 128, 128, 128]} |
| S37 | Tiefe | {"hidden": [34]} |
| S38 | Tiefe | {"hidden": [32, 8, 8]} |
| S39 | Tiefe | {"hidden": [32, 8, 8, 8]} |
| S40 | Aktivierung | {"activation": "relu"} |
| S41 | Aktivierung | {"activation": "leaky-relu"} |
| S42 | Frequenz | {"hz": 10} |
| S43 | Frequenz | {"hz": 15} |
| S44 | Frequenz | {"hz": 20} |
| S45 | Frequenz | {"hz": 60} |
| S46 | Fitness | {"profile": "Speed"} |
| S47 | Fitness | {"profile": "Safety"} |

## Auswahl und Reihenfolge
Baseline 6 Läufe x 12800 = 76800; Evolution 64 x8192=524288; Architektur/Fitness 30 x8192=245760; Bestätigung 18 x25600=460800; Langzeit 4 x51200=204800. Baseline-Prefix exakt 8192 (64 G bei 128); wenn Baseline aus 02C nachweislich identische Konfiguration/Runtime und vollständige Rohdaten hat, Wiederverwendung explizit als solche zählen, nicht erneut als Arbeit. Random Search gleiches G0, danach frische unabhängige Initialisierung ohne Selektion; historischer Kurzlauf kein Beweis allgemeiner Überlegenheit.
Priorität: Baseline, Pilot/Compute, wesentliche gepaarte Varianten, Bestätigung und geschützte Validierung; reserviere auch Budget für spätere Phasen bevor alle Screenings gestartet werden. Paarweise möglichst beide Seeds abschließen, Konfigurationen vor Dispatch festschreiben. Aus der Entwicklungsvalidierung rangiert zunächst Erfolg und Gruppenrobustheit, dann gültige Medianzeit, Fehler, Aufwand; bei fehlendem Erfolg lawful progress/Erfolg bis Budget als Diagnose. Kein Training-Fitness-Vergleich über verschiedene Verträge. Bis fünf Alternativen: mindestens ein Slot für langsam lernende oder abweichende effiziente Variante bei begründetem Potenzial. Auswahl inkl. Tie-Break (ConfigID lexikografisch nach vorab festgelegten Metriken), Datenstand und Hypothese vor nächster Phase dokumentieren. Referenz in Bestätigung. Neue Seeds unverändert. Langzeit zwei Konfigurationen; je zwei Seeds, unabhängige Scratch-Läufe. Optional gesonderte Weitertrainings-, Custom-, Curriculum-, Recovery-, Faktor-/p/alpha-/Crossover-/1024er-Versuche nur innerhalb verbleibender Budgets. Keine künstliche Pflicht, alle optionalen Versuche auszuführen.
Bei 8192 Episoden hat Pop512 nur 16 Generationen, Pop1024 8. Das ist ein Screening, keine abschließende Aussage. Rescue bei 45 stagnierenden Generationen kann nicht bei allen Läufen ausgelöst werden. Nicht ausgelöste Operatoren als solche dokumentieren; gezielte synthetische technische Tests separat. Adapter muss alle tatsächlich freigegebenen D11-Werte prüfen, keine versteckten Anpassungen.
