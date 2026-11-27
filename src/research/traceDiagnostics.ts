import { activate } from '../ai/network';
import { registry } from '../ai/schema';
import type { TraceSample } from '../training/episode';
import type { Model } from '../training/genome';

/** Summarizes sampled observations and decisions without calling the driver. */
export function traceDiagnostics(
  samples: readonly TraceSample[],
  model: Model,
) {
  const channels = registry();
  const inputs = channels.map(({ id }) => ({
    id,
    available: 0,
    masked: 0,
    min: null as number | null,
    max: null as number | null,
  }));
  const layers = model.layers.map(({ width }, index) => {
    const activation =
      index === model.hidden.length ? 'linear' : model.activation;
    return {
      width,
      activation: activation as Model['activation'] | 'linear',
      values: 0,
      zeros: 0,
      negative: 0,
      saturated: activation === 'tanh' ? 0 : null,
    };
  });
  let observation = -1,
    observations = 0,
    decision = -1,
    decisions = 0,
    measuredDecisions = 0;
  for (const sample of samples) {
    if (sample.observationTick < observation || sample.decisionTick < decision)
      throw Error('Trace ticks went backwards');
    if (sample.observationTick !== observation) {
      observation = sample.observationTick;
      observations++;
      if (sample.values.length !== channels.length) throw Error('Trace width');
      channels.forEach((c, i) => {
        const v = sample.values[i],
          row = inputs[i];
        if (
          !Number.isFinite(v) ||
          Math.abs(v) > 1 ||
          (c.rule === 'bit' && v !== 0 && v !== 1)
        )
          throw Error('Invalid observed channel ' + c.id);
        if (c.maskIndex >= 0 && sample.values[c.maskIndex] === 0) {
          if (v !== 0) throw Error('Unmasked value for ' + c.id);
          row.masked++;
          return;
        }
        row.available++;
        row.min = row.min === null ? v : Math.min(v, row.min);
        row.max = row.max === null ? v : Math.max(v, row.max);
      });
    }
    if (sample.decisionTick === decision) continue;
    decision = sample.decisionTick;
    decisions++;
    if (!sample.layers.length) continue;
    if (sample.layers.length !== layers.length)
      throw Error('Trace layer count');
    measuredDecisions++;
    sample.layers.forEach(({ values, sums }, i) => {
      const layer = layers[i];
      if (values.length !== layer.width || sums.length !== layer.width)
        throw Error('Trace layer width');
      values.forEach((v, n) => {
        const z = sums[n];
        const expected =
          layer.activation === 'linear' ? z : activate(z, layer.activation);
        if (!Number.isFinite(z) || !Number.isFinite(v) || v !== expected)
          throw Error('Trace activation differs from the model contract');
        layer.values++;
        if (v === 0) layer.zeros++;
        if (v < 0) layer.negative++;
        if (layer.saturated !== null && Math.abs(v) >= 0.99) layer.saturated++;
      });
    });
  }
  return {
    observations,
    decisions,
    measuredDecisions,
    tanhSaturationAt: 0.99,
    inputs,
    layers,
  };
}
