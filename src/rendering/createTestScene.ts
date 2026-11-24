import {
  BoxGeometry,
  Color,
  GridHelper,
  Mesh,
  MeshNormalMaterial,
  OrthographicCamera,
  Scene,
  TorusGeometry,
  WebGLRenderer,
} from 'three';
import { getViewport } from './viewport';

export const GRAPHICS_ERROR =
  'Die Testszene kann nicht angezeigt werden. Prüfe die WebGL-2-Unterstützung und die Hardwarebeschleunigung deines Browsers.';

export function createTestScene(
  canvas: HTMLCanvasElement,
  onGraphicsError: () => void,
) {
  let renderer: WebGLRenderer;
  try {
    const context = canvas.getContext('webgl2', { antialias: true });
    if (!context) {
      onGraphicsError();
      return;
    }
    renderer = new WebGLRenderer({ canvas, context, antialias: true });
  } catch {
    onGraphicsError();
    return;
  }

  const scene = new Scene();
  scene.background = new Color('#151820');
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.set(7, 6, 8);
  camera.lookAt(0, 0.65, 0);
  const grid = new GridHelper(12, 24, '#555d70', '#2c3241');
  scene.add(grid);

  const material = new MeshNormalMaterial();
  const box = new Mesh(new BoxGeometry(1.4, 1.4, 1.4), material);
  box.position.set(-1.25, 0.7, 0);
  box.rotation.y = Math.PI / 8;
  const ring = new Mesh(new TorusGeometry(0.76, 0.23, 16, 40), material);
  ring.position.set(1.1, 1, 0);
  ring.rotation.y = -Math.PI / 6;
  scene.add(box, ring);

  function render() {
    const viewport = getViewport(
      canvas.clientWidth,
      canvas.clientHeight,
      window.devicePixelRatio,
    );
    if (!viewport) return;

    camera.left = -viewport.halfWidth;
    camera.right = viewport.halfWidth;
    camera.top = viewport.halfHeight;
    camera.bottom = -viewport.halfHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(viewport.pixelRatio);
    renderer.setSize(viewport.width, viewport.height, false);
    renderer.render(scene, camera);
  }

  const observer = new ResizeObserver(render);
  observer.observe(canvas);
  window.addEventListener('resize', render);
  canvas.addEventListener('webglcontextlost', onGraphicsError);
  render();

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', render);
    canvas.removeEventListener('webglcontextlost', onGraphicsError);
    grid.dispose();
    box.geometry.dispose();
    ring.geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
