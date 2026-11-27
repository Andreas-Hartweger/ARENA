import type { GenerationSummary } from '../training/evolution';
export type ChartMetric = 'fitness' | 'laps' | 'diversity' | 'progress';
export function chartPoint(s: GenerationSummary) {
  return {
    generation: s.generation,
    fitness: s.fitness,
    successes: s.successes,
    lapTime: s.lapTimes?.worst ?? null,
    diversity: s.diversity.D,
    progress: s.progress.best,
  };
}
type Point = ReturnType<typeof chartPoint>;
function series(p: Point, metric?: ChartMetric): (number | null)[] {
  const f = p.fitness;
  if (metric === 'laps') return [p.lapTime];
  if (metric === 'diversity') return [p.diversity];
  if (metric === 'progress') return [p.progress];
  const fitness = [f.best, f.mean, f.median, f.q1, f.q3];
  return metric ? fitness : [...fitness, p.lapTime, p.diversity, p.progress];
}
function extrema(points: Point[], limit: number, metric?: ChartMetric) {
  if (points.length <= limit) return points.slice();
  const width = Math.ceil(
    points.length /
      Math.max(
        1,
        Math.floor((limit - 2) / (2 * series(points[0], metric).length + 2)),
      ),
  );
  const indices = new Set([0, points.length - 1]);
  for (let start = 0; start < points.length; start += width) {
    const min: { v: number; i: number }[] = [],
      max: { v: number; i: number }[] = [];
    let markedGap = false;
    indices.add(start);
    for (let i = start; i < Math.min(start + width, points.length); i++)
      for (const [k, v] of series(points[i], metric).entries()) {
        if (v === null) {
          if (!markedGap) indices.add(i);
          markedGap = true;
          continue;
        }
        if (!min[k] || v < min[k].v) min[k] = { v, i };
        if (!max[k] || v > max[k].v) max[k] = { v, i };
      }
    for (const p of [...min, ...max]) if (p) indices.add(p.i);
  }
  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((i) => points[i]);
}
export class ChartHistory {
  #points: Point[] = [];
  add(s: GenerationSummary) {
    this.#points.push(chartPoint(s));
    if (this.#points.length > 2400) this.#points = extrema(this.#points, 1200);
  }
  read(metric: ChartMetric = 'fitness') {
    return extrema(this.#points, 600, metric);
  }
}
