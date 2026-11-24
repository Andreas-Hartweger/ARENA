import { useEffect, useRef, useState } from 'react';
import { version } from '../../package.json';
import { createTestScene, GRAPHICS_ERROR } from '../rendering/createTestScene';

export function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [graphicsError, setGraphicsError] = useState(false);

  useEffect(() => {
    if (canvas.current)
      return createTestScene(canvas.current, () => setGraphicsError(true));
  }, []);

  return (
    <main>
      <header>
        <p className="milestone">Technical Foundation · v{version}</p>
        <h1>PROJECT ARENA</h1>
        <p className="subtitle">AI Racing &amp; Evolution Simulator</p>
      </header>
      <section className="preview" aria-label="Three.js-Testdarstellung">
        <canvas
          ref={canvas}
          aria-label="Orthografische Ansicht geometrischer Testkörper"
        />
        {graphicsError && (
          <p className="error" role="status">
            {GRAPHICS_ERROR}
          </p>
        )}
      </section>
    </main>
  );
}
