import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { loadPanel, loadCandidate, evaluatePanel } from './evaluate-panel.mjs';
import { publishJSON } from './campaign.mjs';
import { inspectDevelopment } from './inspect-development.mjs';
import { auditExperiment } from './audit-data.mjs';
import { hashJSON, sha } from './manifest.mjs';
const { caseStatistics, comparePaired } =
  await import('../../src/research/validation.ts');

// The sealed protocol evaluates each baseline on the same 40 development cases.
// Hash-verified measurements are shared with later selection and never consume a second drive.
export async function baselineDevelopment(directory, ledger, clock, workers) {
  const key = 'baseline-development',
    file = join(directory, 'baseline-development.json');
  const saved = ledger.readManifest(key);
  if (saved) {
    for (const row of saved.runs) {
      if (sha(readFileSync(join(directory, row.file))) !== row.sha256)
        throw Error('Changed baseline development evidence');
    }
    publishJSON(file, saved);
    return saved;
  }
  const seeds = [42, 43, 44],
    methods = ['evolution', 'random'],
    trainingTimes = [];
  for (const seed of seeds) {
    for (const method of methods) {
      const id = 'B-' + method + '-' + seed,
        folder = join(directory, 'experiments', id),
        sealed = ledger.readManifest('baseline-audit:' + id);
      for (const name of ['audit.json', 'prefix-8192.json']) {
        const source = join(folder, name);
        if (!existsSync(source) || sha(readFileSync(source)) !== sealed?.[name])
          throw Error('Audited baseline required before screening: ' + id);
      }
      const statisticsKey = 'baseline-times:' + id;
      let receipt = ledger.readManifest(statisticsKey);
      if (!receipt) {
        const { lapTimeBoundaries, ...audit } = await auditExperiment(
          directory,
          id,
          {
            pulse: () => clock.pulse(),
            timeStatistics: true,
          },
        );
        if (
          hashJSON(audit) !==
          hashJSON(JSON.parse(readFileSync(join(folder, 'audit.json'), 'utf8')))
        )
          throw Error('Published baseline audit differs from the raw records');
        receipt = {
          id,
          auditSHA256: sealed['audit.json'],
          boundaries: lapTimeBoundaries,
        };
        ledger.transaction(() => {
          ledger.assertLease();
          ledger.manifest(statisticsKey, receipt);
        });
      }
      trainingTimes.push(receipt);
    }
  }
  const panel = loadPanel(directory, 'development'),
    runs = [],
    pairs = [];
  for (const seed of seeds) {
    for (const role of ['prefixChampion', 'champion']) {
      const measured = [];
      for (const method of methods) {
        clock.pulse();
        const id = 'B-' + method + '-' + seed;
        const model = loadCandidate(directory, id, role),
          result = await evaluatePanel(ledger, clock, panel, model, workers);
        const summary = caseStatistics(result.actual);
        const casesValid =
          summary.n === panel.cases.length && summary.lawfulProgress !== null;
        if (id === 'B-evolution-42' && role === 'prefixChampion')
          await inspectDevelopment(
            directory,
            ledger,
            clock,
            panel,
            model,
            result,
          );
        const relative = 'experiments/' + id + '/dev-' + role + '.json',
          target = join(directory, relative);
        publishJSON(target, result);
        runs.push({
          id,
          role,
          seed,
          method,
          genome: model.genome.hash,
          episodesPerArm: role === 'prefixChampion' ? 8192 : 12800,
          casesValid,
          statistics: summary,
          file: relative,
          sha256: sha(readFileSync(target)),
        });
        measured.push(result);
      }
      pairs.push({
        seed,
        role,
        complete: measured.every((p) => p.actual.every((c) => c.result.ok)),
        evolutionAgainstRandom: comparePaired(
          measured[0].actual,
          measured[1].actual,
        ),
      });
    }
  }
  const report = {
    schema: 'arena.baseline-dev.v1',
    panel: panel.hash,
    caseCount: 40,
    runs,
    pairs,
    trainingTimes,
    selectionInput: 'development-only',
    evidenceDigest: hashJSON(runs.map((r) => [r.id, r.role, r.sha256])),
  };
  ledger.transaction(() => {
    ledger.assertLease();
    ledger.manifest(key, report);
  });
  publishJSON(file, report);
  return report;
}
