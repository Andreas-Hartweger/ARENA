# Langfristige Forschungs- und Produktroadmap

Nicht implementieren in 02B. First Launch = intern vollständiges spielbares Produkt, öffentliche Freigabe separat.

| Phase | Ergebnis |
|---|---|
| 02A | Wahrnehmung/Brain, gemergt; vollständiges unabhängiges Review ausstehend |
| 02B | Fitness, Evolution, echter technischer From-Scratch-Referenzlauf; keine garantierte gültige Runde |
| 02C D12/D13 | Live/fast/headless Training, Pause/Resume, Population-/Evolution-Übersicht, Modellverwaltung, Persistenz/Checkpoints, Start/Clone/Import |
| 02D D14 | tatsächlicher Lernnachweis über mehrere Seeds, Random-Baseline, Lern-/Recheneffizienz, Validierung; Parameteroptimierung |
| 03A D15/16 | Rennregeln, Gegner, Modi; Human vs AI, AI vs AI, freie Fahrt, Training |
| 03B D17/18 | Profile/Daten, mindestens zweite Strecke |
| 03C D19/20 | Custom AI, UI/HUD, Minikarte-Kandidat; Standard/Advanced |
| 03D D21/22 | Grafik, Audio, Tutorial |
| 03E D23 | Release-QA/First Launch |
| 04–12 (vorläufig) | AI Laboratory/Time Machine/Brain Surgery, Garage, Track Studio, Racing Expansion, Intelligence & Analytics, Career, Immersion, GRID Multiplayer, Advanced Simulation |

Super-KI: gemeinsames leistungsfähigstes Fahrsystem aus ggf. mehreren internen Modulen; nicht zwingend ein einzelnes Netzwerk. Lernprofile sind Trainingsziele, nicht zwingend Laufzeitprofile. Standard AI mit glaubwürdigen kalibrierten Schwierigkeitsstufen, Custom Trained AI und später kontrollierte Custom Programmed AI. Nutzer-KIs können Referenzmodelle schlagen. Aggressive/Defensive echte Mehrfahrzeugtaktik, Adaptability echte Variation. Ziel hohe Rennleistung, Sicherheit im Aufgabenkontext, Robustheit, taktische Intelligenz, keine Behauptung global bester KI.

Forschung nach Launch: Sensoroptimierung (Kameras, Radar, LiDAR, Ultraschall, Fusion, 360°, Störungen, Wetter; Profile/Editor, ohne Preview oder Navigation), Netzwerkarchitektur (MLP, CNN, RNN/GRU/LSTM, Attention, Transformer, NEAT, Gedächtnis, Architecture Search), Evolution (ES, CMA-ES/skalierbare Varianten, Rank/Truncation, adaptive Selektion, korrelierte/sensitivitätsorientierte/semantische Mutation, neuron alignment, speciation, island models/migration, quality diversity/novelty, meta-evolution), RL (PPO/SAC u.a.), Imitation/Transfer/Distillation/Continual/Multi-Task, Mixture of Experts, selbstständiges Curriculum, Self-Play, World Models, physikalische Berechnungen und MPC/Planung, Fahrzeugdaten/dynamische Anpassung/Domain Randomization, Verkehr/Parken/Recovery/Wetter, GPU/CPU Worker/verteilt, Hyperparameter- und Fitnessoptimierung. Unabhängige Holdouts, gleiches Budget und Rechenzeit, Regression bestehender Fähigkeiten. Vergleich statt ungeprüfter Ablösung. Forschungsreihenfolge nicht festgelegt.

Grafische Analyse optional und echte Daten: Population Inspector, Evolution Inspector, Genealogy, Diversity, Genome Heatmap, Mutation Viewer, Parent Comparison, Layer/Activation Analysis, Brain Surgery, Replay einzelner aufgezeichneter Mutationen, Time Machine/Parallel Universe, Sensor/Brain/Fitness Inspectors verbinden. 02B liefert Daten, D12 plant Grundübersicht, vertiefte Analysen nach Launch. Keine dauerhafte Aufzeichnung jedes Ticks/Parameters standardmäßig. Kein Rendering im Headless-Kern. Separate historische Modelle für Rekonstruktion notwendig.
