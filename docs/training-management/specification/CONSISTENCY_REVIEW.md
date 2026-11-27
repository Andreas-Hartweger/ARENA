# Konsistenzprüfung · verbindliche Präzisierungen
Alle 96 Entscheidungen einzeln im Register und Matrix geprüft. Keine grundlegende Produktkollision; folgende kritischen Integrationspunkte erfordern expliziten Vertrag, nicht heimliche Änderung. TF-C Startwerte (Custom RAM cap, archive limits, trace byte limits, STORE-only ZIP, ID format, state/goal/segment encoding) sind abgeleitete technische Konkretisierungen. Bei realem Konflikt A fragen.
| Konflikt | Auflösung | Referenz |
| --- | --- | --- |
| 02B noch Draft vs 02C fertig geplant | PRE-C01 sperrt Code bis vollständiger Report, Review, Merge und CI. | D13.5.9 |
| sync evaluate/collect vs Pause/Workers | Schrittadapter, gleiche Ticklogik, synchroner Wrapper bleibt Referenz; Coordinator split prepare/publish. | D12.2.1/3/8 |
| frozen Evolution.config vs Live-Eingriffe | Revision an Reproduktionsgrenze, neues Segment mit voller Neubewertung, keine rückwirkende Mutation; inkompatibel neuer Run. | D12.3.8 |
| Fitnessziel/Stop vs automatische Folgepopulation | Goal vor Reproduktion; finaler Snapshot next leer. | D12.3.4/5 |
| Pause RAM vs CP disk | RAM exakt mitten Episode, disk nur Boundary; Crash kann ungesicherte Arbeit verlieren. | D13.3.2/6 |
| Durable save vs atomic generation | RAM-Commit und Durable-Status getrennt, mandatory save barrier vor nächstem dispatch. | D13.3.3/5 |
| Crash/real time vs determinism | Unbekannte Zeit transparent, user decision; gleiche logische Budgets für parity. | D12.3.5 D13.3.6 |
| 3 CP vs Disk1GiB vs max pop | Estimate + write reserve, refuse too large; no protected deletion. | D13.3.7 |
| Snapshot analysis vs training quality | Read-only bounded traces, separate analysis resources, no hidden input. | D12.4/5 |
| Digest vs raw byte integrity | 02B canonical +0; raw SHA separately; reject noncanonical exact CP. | D13.4.2 |
| sync Node SHA vs browser async | Stage hashing or verified sync adapter, same digest bytes; no hidden dependency. | D13.5.2 |
| old CP vs newer history | Explicit fork; no rollback overwrite, new session on exact resume. | D13.4.5/9 |
| ZIP distribution vs browser DB | Stable origin, separate app/data, portable exports, 03E packaging not current. | D13.4.10 |
| Trust vs checksum | Separate claims, verified records, official catalog; not a signature. | D13.4.8 |
| 32 queue vs series combos | Preview and bound cardinality; no automatic continuation fault/recovery. | D12.3.6/7 |
| Performance vs exact quality | Full reference and same runtime parity, no tick skips or precision downgrade. | D12.2.9 D13.5.7 |
| D11 multi-scenario weighted score | Existing weighted mean does not guarantee lexicographic success count across scenarios; preserve; later D14 experiment. | D10/D11 |
| Super-KI bigger vs current MLP limit | Versioned future contract, no permanent cap; present resource restrictions. | D13.2.9 |
| TR rules vs actual parallel Codex | Isolate side tasks if possible, otherwise protect main; explicit safe stop for safety. | TR-01–08 |
