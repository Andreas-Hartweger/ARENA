import { SeededRandom } from '../core/random';
import { bounded } from './fitness';
const domains = [
  'init',
  'selection-a',
  'selection-b',
  'cross-choice',
  'cross',
  'mutation',
  'tie',
  'immigrant',
  'scenario',
  'diagnostic',
] as const;
export type Domain = (typeof domains)[number];
export function derivedSeed(
  master: number,
  domain: Domain,
  generation = 0,
  slot = 0,
  scenario = 0,
) {
  for (const n of [master, generation, slot, scenario])
    bounded(n, 0, 0xffffffff, 'seed position', true);
  if (!domains.includes(domain)) throw Error('Invalid seed domain');
  const key = [
    'arena.evo.seed.v1',
    master,
    domain,
    generation,
    slot,
    scenario,
  ].join('|');
  let h = 2166136261;
  for (let i = 0; i < key.length; i++)
    h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return h;
}
export const stream = (
  master: number,
  domain: Domain,
  generation = 0,
  slot = 0,
  scenario = 0,
) => new SeededRandom(derivedSeed(master, domain, generation, slot, scenario));
export type Draw = Pick<SeededRandom, 'next'>;
export function integer(r: Draw, k: number) {
  bounded(k, 1, 2 ** 32, 'integer choice', true);
  if (k === 1) return 0;
  const limit = Math.floor(2 ** 32 / k) * k;
  let x;
  do {
    x = Math.floor(r.next() * 2 ** 32);
  } while (x >= limit);
  return x % k;
}
export function gaussian(r: Draw) {
  return (
    Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(2 * Math.PI * r.next())
  );
}
export function permutation(r: Draw, n: number) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = integer(r, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
