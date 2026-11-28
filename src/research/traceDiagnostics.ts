import { activate } from '../ai/network';
import { registry } from '../ai/schema';
import type { TraceSample } from '../training/episode';
import type { Model } from '../training/genome';
import { wrap, type Track } from '../tracks/track';

/** Groups sampled controls and physical measurements by position within the actual track piece. */
export function drivingDiagnostics(
  samples: readonly TraceSample[],
  track: Track,
) {
  const phases = new Map<
    string,
    { count: number; totals: Record<string, number> }
  >();
  let measured = 0;
  for (const sample of samples) {
    if (!sample.dynamics) continue;
    const { stationM, lateralM, curvaturePerM, physics: p } = sample.dynamics;
    const projection = track.project(sample.position, stationM);
    if (
      Math.abs(projection.s - stationM) > 1e-6 ||
      Math.abs(projection.lateral - lateralM) > 1e-6 ||
      Math.abs(projection.curvature - curvaturePerM) > 1e-9
    )
      throw Error('Trace position and physical projection differ');
    const routeM = wrap(stationM + track.def.startDistance, track.length);
    const piece =
      track.segments.find((s) => routeM < s.offset + s.length) ??
      track.segments.at(-1)!;
    const fraction = (routeM - piece.offset) / piece.length;
    let phase = 'straight';
    if (projection.distance > track.def.width / 2 + track.def.runoff)
      phase = 'outsideRunoff';
    else if (piece.curvature !== curvaturePerM) phase = 'pieceBoundary';
    else if (curvaturePerM !== 0)
      phase =
        fraction < 1 / 3
          ? 'curveFirstThird'
          : fraction < 2 / 3
            ? 'curveMiddleThird'
            : 'curveLastThird';
    const row = phases.get(phase) ?? {
      count: 0,
      totals: {} as Record<string, number>,
    };
    row.count++;
    measured++;
    const values = {
      speedMps: Math.hypot(p.velocityMps.x, p.velocityMps.y),
      throttle: sample.input.throttle,
      brake: sample.input.brake,
      absSteering: Math.abs(sample.input.steering),
      absFrontSlipRad: Math.abs(p.front.slipRad),
      absRearSlipRad: Math.abs(p.rear.slipRad),
      frontTireForceN: Math.hypot(p.front.tireForceN.x, p.front.tireForceN.y),
      rearTireForceN: Math.hypot(p.rear.tireForceN.x, p.rear.tireForceN.y),
    };
    for (const [key, value] of Object.entries(values)) {
      if (!Number.isFinite(value)) throw Error('Invalid measured dynamics');
      row.totals[key] = (row.totals[key] ?? 0) + value;
    }
    phases.set(phase, row);
  }
  return {
    sampled: samples.length,
    measured,
    phases: Array.from(phases, ([phase, row]) => ({
      phase,
      samples: row.count,
      means: Object.fromEntries(
        Object.entries(row.totals).map(([k, v]) => [k, v / row.count]),
      ),
    })),
  };
}

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
