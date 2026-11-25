# Neuronaler Netzwerkkern – D09.1/3 / TF-10–12

## Modell und Parameter

Feedforward vollständig verbunden, ohne Gedächtnis. Standard dims=[248,32,16,3], hidden Tanh, output linear. 1–4 Hidden Layers mit ganzzahlig 4–128 Neuronen, zusätzlich max. 100.000 Gewichte+Bias; Input/Output müssen zum registrierten Schema passen (Standard 248/3). Parameterzahl Σ (n_in+1)*n_out. Standard 7.936+512+48=8.496 Gewichte, 32+16+3=51 Bias, gesamt 8.547, 68.376 Bytes = 66,7734375 KiB. Max. Standard bei 4×128 hidden = 81.795. Anzahl ändert sich im ersten Training nicht; andere Größen vor Training wählbar. Keine automatische Strukturevolution in 02A.

Float64Array contiguous: für Layer mit Offset O, Gewicht w[j,i] bei O+j*n_in+i, Bias[j] bei O+n_out*n_in+j; nächster Offset O+(n_in+1)*n_out. Kopie/Ownership beim Import/Erstellen; kein geteiltes mutierbares TypedArray nach außen (TS readonly allein unzureichend; Object.freeze auf nichtleeren TypedArrays ungeeignet). Modellparameter während Inference unveränderlich; Debug darf nur Kopien/lesende Zugriffsmethoden erhalten. Je Instanz eigene Scratch-Arrays. Parameterkopie für zukünftige Mutation, hier keine Mutation. Validate Anzahl, Float64, endliche Werte, Architektur, Aktivierungen, Schema-/Controller-/Fahrzeugkompatibilität vor Nutzung; keine externe Abhängigkeit.

## Berechnung

Für j in stabiler Reihenfolge: z_j = b_j + Σ_i w_ji*a_i, Summe i aufsteigend, Float64. Tanh=Math.tanh(z), ReLU=max(0,z), Leaky ReLU=z>=0?z:0.01*z, output=z. Prüfe jede Summe/Activation und Rohoutput auf Endlichkeit, kein Overflow als normale Sättigung behandeln. Rohoutput-Adapter separat. Keine Batch-Normalisierung, Dropout, Memory oder stochastic inference. Deterministisch im gleichen unterstützten Runtime-/Seed-/Konfigurationsumfeld, keine pauschale plattformübergreifende Bitgleichheitsgarantie. Referenzmodell und optional optimierter Kern gegen gleiche Reihenfolge/Toleranzen testen.

## Initialisierung (TF-10)

Vorhandene `SeededRandom` Mulberry32, seed integer uint32 0..4294967295 (0 erlaubt). Pro Layer in Parameterreihenfolge ein RNG-Aufruf pro Gewicht, w=(2*u−1)*a, u in [0,1); keine RNG-Aufrufe für Bias, alle +0. Glorot-Uniform a=sqrt(6/(n_in+n_out)) bei Tanh und linearer Ausgabeschicht. He-Uniform a=sqrt(6/n_in) bei ReLU; Leaky ReLU a=sqrt(6/((1+0.01²)*n_in)). Keine globale RNG-Mutation, Initialisierung pro Modell separat seedbar. Speichere Algorithmus-/Layoutversion und Seed in Modellmetadaten. Anfangs zufällige untrainierte Modelle nicht als fahrfähig bezeichnen.

## Inference-Vertrag

Pure math plus optional Trace: Eingang, gewichtete Summen und Aktivierungen je Layer, Rohoutput; bei Fehler kein gültiger Output. Trace deaktiviert: keine unnötigen vollständigen Kopien/Verbindungsobjekte. Validierung darf optimiert sein, muss aber Fehler an Schnittstellen sicher erkennen. MLP kann Zusammenhänge approximieren, kein expliziter Weltmodell-/Bremswegrechner zugesichert. Testfixtures: kleine isolierte math-core-Netze (abweichende Dimensionen NUR für Unit-Tests, nicht Produktionsmodell) und vollständiges 248/32/16/3 Fixture mit Bias-Steuerung; Testdaten klar benennen.
