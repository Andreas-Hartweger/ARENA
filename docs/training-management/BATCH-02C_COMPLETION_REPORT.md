# Abschlussbericht · Batch 02C

Stand 27.11.2026. Das Trainingslabor, die Laufsteuerung, der parallele Evaluator und die persistente Modellverwaltung liegen im [Review-PR #7](https://github.com/Andreas-Hartweger/ARENA/pull/7). A hat die technische Umsetzung von 02C freigegeben. Für die Übernahme von 02C in `main` sieht v0.10 ein unabhängiges Schlussreview und eine gesonderte Mergefreigabe vor. Prüfkriterien und Belege stehen in der [Abnahmematrix mit 210 Punkten und 96 Entscheidungen](ACCEPTANCE_RESULTS.md).

## Übergang von 02B zu 02C

A delegierte die verbleibenden Abnahmeschritte für 02B und autorisierte den Merge nach erfolgreicher Prüfung. Der Stand von B wurde gegen die freigegebene Vorgängerversion geprüft. Die 213 Tests, die Kalibrierung, die vollständige Referenz und das Review der Kontaktkorrekturen, der Ziellinieninterpolation und der Fehlerisolation bildeten die Abnahmebasis. PR #6 wurde als `c74ab27daf3159329d9049076ab3c30c5a4759ea` gemergt. Erst nach erfolgreicher CI auf diesem Commit begann die Umsetzung von 02C. [02B-Abschlussbericht](../first-evolution/BATCH-02B_COMPLETION_REPORT.md) · [PR #6](https://github.com/Andreas-Hartweger/ARENA/pull/6) · [CI auf main](https://github.com/Andreas-Hartweger/ARENA/actions/runs/46009031010)

Alle 26 Dateien im ZIP v0.10 entsprechen byteweise dem archivierten Paket. Der separat übergebene Excel-Masterplan stimmt mit dem Exemplar im ZIP überein. Die Arbeitsgrundlage umfasst 18 Pakete. [Spezifikation und Originalprompt](specification/BATCH-02C_CODEX_PROMPT.md) · [Paketprüfsummen](evidence/checks.json)

## Lieferumfang

| Paket   | Ergebnis der technischen Bearbeitung                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| PRE-C01 | 02B-Review, Mergefreigabe, grüne Basis und Herkunft der historischen Daten dokumentiert.                                              |
| TL-001  | Getrennte Verträge für Befehle, Snapshots, Compute und Speicher. Teamregeln TR-01 bis TR-08 übernommen.                               |
| TL-002  | Gemeinsamer tickweiser Evaluator für synchronen Aufruf, Worker, Pause und Beobachtung.                                                |
| TL-003  | Coordinator und echter Workerpool. Versuche, kanonische Slots, Quittungen, veraltete Antworten und begrenzter Retry.                  |
| TL-004  | Phasen und Grenzveröffentlichung, weiche und harte Ziele, Änderungen an Segmentgrenzen und exakter Wiederanlauf.                      |
| TL-005  | Eco, Balanced, Performance und Custom mit CPU- und RAM-Vorprüfung. Zieltempo, Durchsatz und begrenzte Telemetrie.                     |
| MM-001  | IndexedDB mit Schreibmonopol und Epochenprüfung, unveränderliche Versionen und kanonischer Genom-Fingerprint.                         |
| MM-002  | Initial-, Generations- und Abschluss-Checkpoint, automatische Aufbewahrung und Wiederherstellung des letzten gültigen Stands.         |
| MM-003  | Modellprofile, Herkunft, Versionen, Klone, Championrollen und getrennte Leistungsrekorde je Aufgabenvertrag.                          |
| MM-004  | Speicherbudget, geschützte Referenzen, Löschvorschau, Papierkorb und Meilensteine.                                                    |
| MM-005  | Modell-, Checkpoint- und Backuppakete mit Vorschau, Prüfsummen, vollständigen Referenzen und atomarer Publikation.                    |
| MM-006  | Migration mit echten Binärdaten, blockiertes Schema-Update und Anwendungstausch auf derselben Origin.                                 |
| TL-006  | Laufentwurf, benannte Vorlage, FIFO-Warteschlange, Serien und getrennte Freigabe des automatischen Folgeauftrags.                     |
| TL-007  | Standard-, Advanced- und Headless-Ansichten, Kamera, tatsächliche Fahrspuren, HUD, Verlauf und Population.                            |
| TL-008  | Sensor-, Brain-, Fitness- und Evolutionsansichten, Parametervergleich und schreibfreie Vergleichsfahrt.                               |
| MM-007  | Modellassistent, Bibliothek und Speicherbereich mit Importvorschau, Checkpoints und Wiederherstellungsaktionen.                       |
| QA-C01  | Referenzparität, Benchmarks, UI- und Speicherprüfungen sind belegt. Den Headless-Dauerteil von SYS-03 hat A nach Abbruch geschlossen. |
| REL-C01 | Bericht, Matrix, Teamübergabe und gemeinsamer PR. Unabhängiges 02C-Review und Mergefreigabe liegen bei A/B.                           |

## Bedienung

1. In First Drive **Trainingslabor** öffnen. Strecken-, Fahrzeug- und Modellverweise füllen den Entwurf. Erst **Training starten** beginnt die Berechnung.
2. Für volle Rechenleistung im Lauf **Headless**, **Max** und anschließend ein zur Maschine passendes Workerprofil wählen. Der Coordinator verteilt vollständige Episoden auf CPU-Worker und veröffentlicht eine Generation erst nach vollständiger Auswertung. Der Referenzvertrag verwendet Float64, 60 Hz Physik und 30 Hz für Sensoren und Inferenz.
3. In **Modelle** eine Version initialisieren, aus einer vorhandenen Version klonen oder einen Import öffnen. Für ein echtes Resume im Bereich **Speicher** den Checkpoint wählen. Ein Modellpaket enthält die Gewichte einer Version. Ein Checkpoint umfasst zusätzlich den Laufzustand und die Folgepopulation.
4. Browserprofil, Protokoll, Host und Port bestimmen den lokalen Datenbestand. Bei einem Update dieselbe Origin verwenden. Ein Backendwechsel oder Gerätewechsel erfolgt über den expliziten Export und die geprüfte Importvorschau.

## Referenz und numerische Genauigkeit

**Node.** Acht Worker führten 100 Generationen mit je 128 Kandidaten aus. Die 12.800 Kandidatenzeilen stimmen byteweise mit der freigegebenen seriellen 02B-Referenz überein. Alle logischen Generationen, Rangfolgen, Eltern, Folgepopulationen und der finale Champion stimmen überein. Der Lauf erreichte die erste gültige Runde in G31, erzielte 664 erfolgreiche Runden und eine Bestzeit von 59,663775 s. Finaler Fingerprint `5ea750f9d24cb861b2a901f9e325dd0b79f0b4a8f45c94a2202829ae4eb21c95`. Die komplette 02C-CLI einschließlich Dateiausgabe benötigte 983,43 s. Die historische 02B-Aktivzeit betrug 4.854,22 s. Unterschiede in Messgrenzen und Hintergrundlast begrenzen den Zeitvergleich. [Node-Rohvergleich](evidence/node-pool-reference.json) · [02B-Referenzaudit](../first-evolution/evidence/reference-audit.json)

**Browser.** Der serielle Referenzlauf und der Vier-Worker-Lauf endeten jeweils nach 12.800 Auswertungen bei G99. In allen 100 Generationen stimmen die vollständigen Generationsdaten, Rangfolgen, Folgepopulations-Hashes und der Champion exakt überein. Nach G99 war die Folgepopulation leer. Ein unabhängig aufgezeichneter Vier-Worker-Lauf bestätigte dieselben Werte und sicherte alle 12.800 Episodenergebnisse. Das sind 30.575.874 Simulationsticks, 664 gültige Runden, erster Erfolg in G31 und 59,663775 s Bestzeit. Der archivierte Lauf erfasste 60 min 28 s mit Pflichtsicherungen. Die Originalmessung des ersten Browserlaufs enthält eine Rechnerunterbrechung. Beide Referenzläufe meldeten am Ende jeweils drei Checkpoints. [Seriell und parallel](evidence/browser-reference/end.json) · [Nachrechnung der Archivdaten](evidence/browser-reference/audit.json) · [Archivvergleich](evidence/browser-archive/end.json) · [Rohdaten der Kandidaten](evidence/browser-archive/browser-generations.ndjson.gz) · [Championgewichte und Prüfsummen](evidence/browser-archive/milestones.ndjson)

**Plattformvergleich.** In einer getrennten 600-Tick-Prüfung sind Szenariovertrag, diskretes Ende und die 32 uniformen Zufallswerte zwischen Node und Chromium gleich. Die größte absolute Abweichung der sieben Fitnesswerte betrug rund 1,64 × 10⁻¹³ bei einer Grenze von 10⁻⁹. Über alle 12.800 nach Generation und Slot gepaarten Kandidaten stimmten IDs, Eltern, Endgründe und Rundenzahlen überein. In 12.799 Fällen war auch der Endtick identisch. Der Kandidat G99/Slot 112 fuhr in Chromium 30 Ticks länger und beendete seine Runde rund 0,4935 s später. Die Bestzeit beider Plattformen blieb auf sechs Dezimalstellen gleich. 137 Genom-Fingerprints stimmten plattformübergreifend überein. Die erste Gewichtsabweichung lag in G1/Slot 6. Der parallele Browserlauf ergab den finalen Champion `8e3d307775f012a80c85481b1eb34cbb3d78e047136a70f2c6fba7b57b2a07f4`. [Gepaarter Vergleich aller Kandidaten](evidence/cross-runtime-reference.json) · [Toleranzen und Grenzprofile](evidence/browser-scale.json)

Die Originalgewichte der historischen 02B-Champions G0, G31 und G99 fehlen in den damaligen Dateien. Erhalten sind Konfiguration, Seeds, Hashes und die 12.800 Ergebnisdatensätze. Neu in 02C berechnete Modelle haben eine eigene Laufherkunft. Die Freigabe eines offiziellen Starters und die Bewertung der Lernfähigkeit gehören zu D14.

## Zuordnung der Prüfnachweise zum Übergabestand

Der vollständige Browservergleich verwendet `b6b28f3`. Die unabhängige Archivierung auf `8a23ca0` prüft denselben Referenzvertrag nach Einführung der begrenzten Historie. Zwischen `8a23ca0` und dem Übergabestand blieb `src/training` unverändert. Die späteren Änderungen betreffen unter anderem Telemetrie, das Abweisen geschlossener Worker und die Prüfung gespeicherter Daten. Dafür liegen kurze Worker-, Speicher- und echte Browserprüfungen am jüngeren Stand vor. Die Änderung von `384165e` zu `1b99d13` betraf zwei Node-Skripte für den Vergleich mit dem früheren Checkout. [Referenzkonfiguration](evidence/browser-reference/start.json) · [Browserfenster auf 384165e](evidence/browser-windows/start.json) · [Abschließender Projektcheck](evidence/checks.json)

Die vollständige Browser-Evidenz lässt sich mit `node scripts/verify-training-evidence.mjs` aus dem Projektverzeichnis erneut prüfen. Der Befehl liest die drei aufgezeichneten Ergebnisreihen und die Gewichtsdateien. Er prüft pro Generation sämtliche Ergebnis-Hashes und die nächste Population und berechnet die Fingerprints aus den gespeicherten Float64-Bytes. [Prüfskript](../../scripts/verify-training-evidence.mjs)

## Durchsatz und Ressourcen

Messrechner mit Windows 11 Pro, Intel Core Ultra 7 255H, 16 logischen CPUs, 33.820.106.752 Byte RAM, Node 24.22.3 und Chromium 158.0.8127.89. Die Fenster verwendeten einen Warm-up und feste, identische Aufgaben. Geräteleistung und Hintergrundlast waren unkontrolliert. Zeitfenster mit sechs Ticks für große Architekturen sind ausdrücklich als Stresstests markiert. [Node-Konfiguration](evidence/node-windows/start.json) · [Browserkonfiguration](evidence/browser-windows/start.json) · [Grenzprofile](evidence/browser-scale.json)

| Gemessener Fall                                                 | Median                          | Messumfang                                                                                             |
| --------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Reguläre Node-Episoden, seriell 02B / seriell 02C / vier Worker | 5,099 / 5,393 / 1,489 s         | Je 9.934 echte Ticks, identisches Ergebnis. Die Knotenzeiten umfassen Evaluation und Evolutionscommit. |
| Browser Max, seriell / ein / zwei / vier Worker                 | 1,111 / 1,141 / 0,635 / 0,495 s | Je acht Episoden zu 180 Ticks im Messfenster, jeweils drei Messwiederholungen.                         |
| Browser, zwei Worker, Trace / Beobachtung                       | 0,785 / 0,659 s                 | Identische logische Arbeit, sichtbare Daten aus echten Samples.                                        |
| Browser mit Zieltempo 10× / 1×                                  | 1,517 / 12,982 s                | Mehrere Episoden je Worker. Zieltempo pro Episode und Gesamtdurchsatz sind getrennt.                   |
| Browser, vier Worker, Save / Restore                            | 10,1 / 17,8 ms                  | Median der gemessenen Grenzspeicher- und Wiederherstellungsvorgänge.                                   |

Im gepaarten 30-Hz-Node-Fenster mit 32 Kandidaten und 600 Ticks pro Kandidat erzielten acht Worker den höchsten gemessenen Median mit 6.242 Ticks/s. Vier Worker erreichten 5.201, zwölf Worker 3.636 und vierzehn Worker 3.205 Ticks/s. Auf diesem Rechner weist Balanced acht Worker zu. Die konkrete Auslastung und die Länge der Episoden beeinflussen den Durchsatz. [Workerprofile und Einzelwerte](evidence/node-windows/raw.ndjson)

Die Node-Rohdaten weisen auch Ticks/s, simulierte Sekunden pro realer Sekunde, Episoden/min, Worker-Rechenzeit, RSS und Heap aus. Die Browserfenster umfassen die vorgeschriebenen Anfangs-, Grenz- und Abschlusssicherungen. Die Rohdaten enthalten Einzelwerte sowie Minimum, Median und Maximum je Fenster. [Node-Fenster](evidence/node-windows/end.json) · [Browserfenster](evidence/browser-windows/end.json) · [Browser-Einzelmessungen](evidence/browser-windows/raw.ndjson)

Zwei serielle Fenster unterschritten in der ersten Dreifachmessung die 85-Prozent-Schwelle gegenüber 02B. Sieben zusätzliche gepaarte Läufe mit wechselnder Reihenfolge ergaben bei 30 Hz 16,212 s für 02B und 16,157 s für 02C. Bei 10 Hz waren es 1,989 s und 1,931 s. Die Ergebnis-Hashes blieben gleich. Der anfängliche Durchsatzverlust ließ sich unter diesen Bedingungen nicht reproduzieren. [Siebenfachmessung](evidence/serial-investigation/end.json)

## Stabilität, Bedienung und Speicher

Der Browser bediente während 1.203,27 s bestätigter aktiver Zeit das laufende Training. 189 Bedienzyklen, 149 bestätigte Generationen, keine Messlücke über 30 s und keine protokollierten JavaScript-Fehler. Bei je 24 vollständigen Bedienvorgängen lagen die p95-Zeiten für Pause bei 255,7 ms und für Fortsetzen bei 389,2 ms. Gemessen wurde vom Browserklick bis zur sichtbaren Phasenbestätigung einschließlich der sicheren Grenze. Elf verschiedene angezeigte Frames im getrennten UI-Kurztest ergaben 18,3 ms Median und 57,7 ms p95 von der Erzeugung bis zur Übergabe an die Ansicht. p95 bezeichnet den nach oben gerundeten 95-Prozent-Rang der aufsteigend sortierten Einzelwerte. [Bedienprotokoll](evidence/ui-stability/end.json) · [Snapshot-Einzelwerte](evidence/ui-entry/snapshot-latency.json) · [Modellbibliothek bei 390 Pixeln](evidence/ui-entry/models-mobile.png)

**SYS-03, Headless. Soll-Dauer 2 Stunden. Status erledigt auf Anweisung von A.** Die Vorläufe endeten um 19:07 Uhr nach 96 min 7 s (745 bestätigte Generationen, 11.920 Auswertungen) und 58 min 48 s (414 Generationen, 6.624 Auswertungen). A beauftragte anschließend einen einzelnen Endabnahmelauf auf dem geprüften Stand `1b99d13` und ordnete um 19:14 Uhr dessen sofortigen Abbruch und Abschluss an. Die letzte Stichprobe dieses Laufs erfasste 50,08 s aktive Zeit, zehn persistent bestätigte Generationen und 160 Auswertungen. Jeder Lauf hat eine eigene Messreihe. Ein zweistündiger Erfolg ist durch die erhobenen Daten nicht belegt. Die separaten Restore-Prüfungen sind bestanden. [Messwerte der drei Läufe](evidence/endurance/end.json) · [Restore im Browser](evidence/browser-storage-final.json)

Bei den drei Wiederholungen benötigten Export, Vorschau und Import im Median 12,9 / 52,8 / 17,2 ms für ein Modellpaket, 17,8 / 74,6 / 24,6 ms für einen Checkpoint und 26,8 / 117,1 / 30,9 ms für ein Backup. [Transfermessungen](evidence/browser-storage-final.json)

Die Speicherprüfung umfasste drei frische Profilpaare für Modell, Checkpoint und Backup, einen identischen Wiederimport, einen ID-Konflikt mit separater Variante und das Verzweigen eines älteren Checkpoints. Ein zweiter Tab und ein veralteter Writer wurden abgewiesen. Beim Update unter derselben Origin blieben beide Modelle erhalten. Bei korruptem jüngstem Stand gelang die Wiederherstellung über einen älteren gültigen Checkpoint. Eine zu kleine Quote ließ den Queue-Lauf vor G0 in den wiederherstellbaren Zustand wechseln. Nach explizitem Retry waren seine acht Kandidaten bestätigt und der Folgeauftrag wartete weiterhin. [Fehler-, Transfer-, Fencing- und Updateprotokoll](evidence/browser-storage-final.json)

Der isolierte Modellvergleich verwendete einen eigenen Analyseworker. Identisch blieben Run-ID, Session, Commit, Checkpoint, Arbeitscursor, reservierte Worker und Ausgangsgenom der Hauptsession. Die 02C-Prüfungen verwendeten eigene Prozesse, Testprofile und Datenbanken. [TR-01 bis TR-08](../team/DEVELOPMENT_CONTINUITY_CONTRACT.md) · [Vergleich und Zustandsprüfung](evidence/browser-storage-final.json)

## Installation, Regression und Freigabestand

Die saubere Installation und der Projektcheck auf `1b99d131ded2484f4f0a0122bb73bd52001825c0` bestanden mit 233 Tests in 34 Dateien. Darunter sind alle 213 ursprünglichen Tests in 29 anhand ihrer Git-Objekte unverändert bestätigten Dateien. Der separate Vergleich mit 02A lieferte in allen fünf Welt-Fällen identische Hashes mit und ohne Diagnosefeed. Die erneute Auswertung der 02C-Node-Ausgabedaten bestätigte 12.800 Kandidaten, 594 Elite-Neubewertungen und die Reproduktion aller 100 Generationen. Die GT-01-Kalibrierung stimmt als JSON vollständig mit 02B überein. Bei einer parallel zu mehreren Abnahmeläufen ausgeführten Prüfung liefen zwei ältere Tests in ihr Zeitlimit. Mit zwei Vitest-Prozessen bestanden dieselben Tests mit unveränderten Fristen. Vite meldet weiterhin 570,49 kB minifiziert für den separat geladenen First-Drive-Chunk bei 500 kB Warnschwelle. Das Labor-JavaScript umfasst 74,46 kB minifiziert. [Installations- und Prüfprotokolle](evidence/checks.json) · [Neuprüfung aller 128 früheren Katalogpunkte](evidence/legacy-coverage.json) · [Ursprüngliche 02B-Abnahmematrix](../first-evolution/ACCEPTANCE_RESULTS.md)

Der stabile Browser-Origin-Vertrag und das Update wurden in 02C geprüft. Das Offline-Paket und die Installation auf einem frischen Rechner gehören zu 03E. Das unabhängige Review von 02C und die gesonderte Mergefreigabe durch A sind offen. [Review-PR](https://github.com/Andreas-Hartweger/ARENA/pull/7) · [Releaseplan](specification/FUTURE_ROADMAP.md)

**NÄCHSTER PLANUNGSAUFTRAG ERFORDERLICH.** A/B prüfen die technische Übergabe. Über den Merge entscheidet A gesondert.
