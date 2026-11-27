// MessageChannel yields to other tasks without nested timer clamping.
export function taskQueue() {
  const channel = new MessageChannel(),
    callbacks: (() => void)[] = [];
  channel.port1.onmessage = () => callbacks.shift()?.();
  return (callback: () => void, delay = 0) => {
    if (delay > 0) {
      setTimeout(callback, delay);
      return;
    }
    callbacks.push(callback);
    channel.port2.postMessage(null);
  };
}
