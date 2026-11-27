import { canonical } from '../ai/schema';
import { SeededRandom } from '../core/random';
import { freezeTree } from '../physics/vehicleTick';
import { createTrack } from '../tracks/track';
import { GT_01 } from '../vehicles/vehicleDefinition';
import { startGrid } from '../tracks/grid';
import { derivedSeed } from '../training/random';
import { startState, type ScenarioStart } from '../training/scenarioStart';
import type { Digest, ScenarioOptions } from '../training/episode';

export const panelSizes = {
  development: [14, 13, 13],
  holdout: [20, 20, 20],
  endurance: [4, 4, 4],
  recovery: [6, 6, 6],
} as const;
export type PanelName = keyof typeof panelSizes;
export function buildPanels(digest: Digest, roots: Record<PanelName, number>) {
  const track = createTrack(),
    standard = startGrid(track, 1, GT_01.lengthM, GT_01.widthM)[0];
  const physicalKey = (state: {
    positionM: { x: number; y: number };
    headingRad: number;
    velocityMps: { x: number; y: number };
  }) => digest(canonical(state));
  const seen = new Set([
    physicalKey({
      positionM: standard.position,
      headingRad: standard.heading,
      velocityMps: { x: 0, y: 0 },
    }),
  ]);
  if (new Set(Object.values(roots)).size !== 4)
    throw Error('Panel roots must be independent');
  const entries = (Object.keys(panelSizes) as PanelName[]).map((name) => {
    const cases = [];
    for (const [group, count] of panelSizes[name].entries())
      for (let i = 0; i < count; i++) {
        let accepted = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          const seed = derivedSeed(roots[name], 'scenario', group, i, attempt),
            rng = new SeededRandom(seed);
          const sign = (i + group) % 2 === 0 ? 1 : -1,
            unit = () => 0.1 + 0.9 * rng.next();
          const recovery = name === 'recovery';
          const start: ScenarioStart = {
            version: 1,
            kind: recovery ? 'recovery' : 'road',
            stationM: -7 - 10 * rng.next(),
            lateralM:
              sign *
              (recovery && group > 0
                ? track.def.width / 2 +
                  (group === 1 ? 1.6 : track.def.runoff - 3) +
                  rng.next() * 0.5
                : [0.5, 1.5, 2.5][group] * unit()),
            headingRad:
              ((i % 4 < 2 ? 1 : -1) *
                (recovery && group === 0
                  ? 40 + 80 * rng.next()
                  : [5, 15, 30][group] * unit()) *
                Math.PI) /
              180,
            speedMps: 10 * rng.next(),
          };
          let pose;
          try {
            pose = startState(track, start);
          } catch {
            continue;
          }
          const effective = physicalKey(pose);
          if (seen.has(effective)) continue;
          seen.add(effective);
          const id = name + '-' + group + '-' + i;
          const scenario: ScenarioOptions = {
            id,
            seed,
            start,
            purpose: name === 'development' ? 'validation' : 'test',
            ...(name === 'endurance'
              ? { task: { laps: 3, maxTicks: 21600 } }
              : recovery
                ? { task: { maxTicks: 1500, noProgressTicks: 1500 } }
                : {}),
          };
          cases.push({ id, group, attempt, effective, scenario });
          accepted = true;
          break;
        }
        if (!accepted)
          throw Error('Cannot generate distinct physical start for ' + name);
      }
    return [
      name,
      freezeTree({
        version: 1,
        name,
        root: roots[name],
        physicsHz: 60,
        vehicle: 'GT-01',
        trackHash: digest(canonical(track.def)),
        cases,
        hash: digest(canonical(cases)),
      }),
    ] as const;
  });
  return freezeTree(
    Object.fromEntries(entries) as Record<
      PanelName,
      (typeof entries)[number][1]
    >,
  );
}
