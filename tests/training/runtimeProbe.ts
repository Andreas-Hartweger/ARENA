import { Brain } from '../../src/ai/network';
import { evaluate, scenario, type Digest } from '../../src/training/episode';
import { model } from '../../src/training/genome';
import { mutate, standardMutation } from '../../src/training/operators';
import { derivedSeed, gaussian, stream } from '../../src/training/random';

// A bounded, from-scratch driving fixture. The supplied digest is only used for the two scenario contract headers.
export function runtimeProbe(digest: Digest) {
  const s = scenario(digest, {
    seed: derivedSeed(42, 'scenario'),
    task: { maxTicks: 600, graceTicks: 60, noProgressTicks: 300 },
  });
  const m = model(s.modelSignature),
    seed = derivedSeed(42, 'init'),
    starter = new Brain(m.signature, seed);
  const change = mutate(
    m,
    starter.parameters(),
    standardMutation,
    stream(42, 'mutation', 1, 6),
  );
  const candidate = new Brain(
    m.signature,
    0,
    m.hidden,
    m.activation,
    change.parameters,
  );
  const episode = evaluate(s, candidate, { maxSamples: 3, everyTicks: 120 });
  if (!episode.ok) throw Error(episode.message);
  const r = stream(42, 'diagnostic'),
    z = stream(42, 'diagnostic');
  return {
    contract: s.key,
    reason: episode.reason,
    ticks: episode.tick,
    uniform: Array.from({ length: 32 }, () => r.next()),
    gaussian: Array.from({ length: 32 }, () => gaussian(z)),
    genes: Array.from(change.parameters),
    fitness: Object.values(episode.fitness),
    errors: episode.errors,
    positions: episode.trace!.samples.flatMap((s) => [
      s.position.x,
      s.position.y,
    ]),
    observation: episode.trace!.samples.flatMap((s) => s.values),
    activations: episode.trace!.samples.flatMap((s) =>
      s.layers.flatMap((l) => l.values),
    ),
  };
}
