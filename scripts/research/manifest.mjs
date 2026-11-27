import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const { canonical } = await import('../../src/ai/schema.ts');
const { freezeTree } = await import('../../src/physics/vehicleTick.ts');
const { defaultDraft, preflight } =
  await import('../../src/runtime/runConfig.ts');
import { digest } from '../evolution-runtime.mjs';

const baseURL = new URL(
  '../../docs/intelligence-validation/specification/',
  import.meta.url,
);
const sources = JSON.parse(
  readFileSync(new URL('PACKAGE_MANIFEST.json', baseURL), 'utf8'),
);
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const hashJSON = (value) => sha(canonical(value));

function input(name) {
  const bytes = readFileSync(new URL(name, baseURL));
  const spec = sources.files[name];
  if (!spec || spec.sha256 !== sha(bytes) || spec.bytes !== bytes.length)
    throw Error('Research input integrity failure: ' + name);
  return bytes.toString('utf8');
}
const plan = freezeTree(JSON.parse(input('research_config.json')));
const csv = input('experiments.csv');
export const matrixHash = sha(csv);
function fields(line) {
  const columns = [];
  let value = '',
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      columns.push(value);
      value = '';
    } else value += c;
  }
  if (quoted) throw Error('Unclosed CSV field');
  return [...columns, value];
}
const [header, ...lines] = csv.trim().split(/\r?\n/);
const keys = fields(header);
export const slots = freezeTree(
  lines.map((line) => {
    const values = fields(line);
    if (values.length !== keys.length) throw Error('Invalid experiment row');
    return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
  }),
);
export const caps = Object.freeze({
  ms: 48 * 3600000,
  episodes: 1600000,
  ticks: 5000000000,
});
export const trainingCaps = Object.freeze({
  ...caps,
  ms: 146880000,
  ticks: 4250000000,
});

export function experiment(id, campaignId, workers, hardware, selectedConfig) {
  const slot = slots.find((row) => row.ExperimentID === id);
  if (!slot || !/^[A-Za-z0-9_-]{1,80}$/.test(campaignId))
    throw Error('Unknown slot or invalid campaign');
  const finalist = slot.ConfigID.startsWith('Finalist ');
  if (finalist !== !!selectedConfig)
    throw Error('Selection does not match slot');
  const configId = selectedConfig ?? slot.ConfigID;
  const variant = plan.variants.find((row) => row.id === configId);
  if (!variant && !['evolution', 'random', 'Baseline'].includes(configId))
    throw Error('Unknown research config');
  const c = variant?.config ?? {
    ...plan.baseline,
    randomSearch: configId === 'random',
  };
  if (
    c.physicsHz !== 60 ||
    c.scenarioCount !== 1 ||
    c.task !== 'academy-standard-v1' ||
    c.adaptMultiplier !== 1.5
  )
    throw Error('Incompatible research contract');
  const episodeBudget = Number(slot.EpisodeBudget),
    masterSeed = Number(slot.Seed);
  const generations = Math.floor(episodeBudget / c.population);
  if (
    (slot.Population && Number(slot.Population) !== c.population) ||
    (slot.FullGenerations && Number(slot.FullGenerations) !== generations)
  )
    throw Error('Inconsistent matrix budget');
  const draft = defaultDraft();
  Object.assign(draft, {
    hidden: [...c.hidden],
    activation: c.activation === 'leaky-relu' ? 'leaky' : c.activation,
    scenarios: [{ sensorHz: c.hz, decisionHz: c.hz, fitness: c.profile }],
    profile: 'Custom',
    custom: { workers, managedMiB: 1024 },
  });
  draft.options = {
    master: masterSeed,
    n: c.population,
    budget: episodeBudget,
    generations,
    tournament: c.tournament,
    eliteRate: c.eliteRate,
    poolFraction: c.parentPool,
    crossProbability: c.crossoverProbability,
    operator: c.crossoverOperator,
    mutation: {
      p: c.mutationProbability,
      alpha: c.mutationAlpha,
      largeProbability: c.largeProbability,
      largeMultiplier: c.largeMultiplier,
    },
    adaptation: {
      window: c.stagnationWindow,
      epsilon: c.stagnationEpsilon,
      probabilityEnabled: c.adaptProbability,
      strengthEnabled: c.adaptStrength,
      immigrantRate: c.immigrantRate,
      rescueEnabled: c.rescueEnabled,
    },
    randomSearch: c.randomSearch,
  };
  if (Math.ceil(c.population * c.parentPool) < c.tournament)
    throw Error('Tournament exceeds parent pool');
  const { m, scenarios } = preflight(draft, digest, hardware);
  const definition = freezeTree({
    version: 1,
    campaignId,
    experimentId: id,
    phase: slot.Phase,
    hypothesis: variant?.group ?? slot.ConfigID,
    configId,
    configHash: hashJSON(c),
    matrixHash,
    algorithmId: c.randomSearch ? 'D11-random-v1' : 'D11-evolution-v1',
    masterSeed,
    modelContract: m.key,
    scenarioManifestHash: hashJSON(
      scenarios.map((s) => ({ id: s.id, key: s.key, seed: s.seed })),
    ),
    taskVersion: c.task,
    fitnessVersion: 'D10-v1/' + c.profile,
    episodeBudget,
    computeBudget: trainingCaps,
    outputPolicy: 'committed-generations-and-all-attempts-v1',
    draft,
  });
  return freezeTree({ hash: hashJSON(definition), definition });
}
