import { lazy, Suspense, useEffect, useState } from 'react';
const FirstDrive = lazy(() =>
  import('./App').then((m) => ({ default: m.App })),
);
const TrainingLab = lazy(() => import('./TrainingLab'));
export function Router() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => setHash(location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return /^#\/(training|models|storage|queue)/.test(hash) ? (
    <Suspense
      fallback={
        <main className="lab-loading" role="status">
          Trainingslabor wird geladen …
        </main>
      }
    >
      <TrainingLab route={hash.slice(2).split('?')[0]} key="lab" />
    </Suspense>
  ) : (
    <Suspense fallback={<main role="status">First Drive wird geladen …</main>}>
      <FirstDrive />
    </Suspense>
  );
}
