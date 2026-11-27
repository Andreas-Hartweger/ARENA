import { useEffect, useState } from 'react';
import { trainingLab } from './labClient';
import type { LabCommand } from '../runtime/labProtocol';
export function useLabQuery<T>(
  command: LabCommand | null,
  revision: number | string = 0,
) {
  const signature = command ? JSON.stringify(command) : null;
  const [state, setState] = useState<{ signature: string; value: T } | null>(
      null,
    ),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    if (signature !== null) {
      trainingLab()
        .call<T>(JSON.parse(signature))
        .then(
          (value) => {
            if (live) {
              setState({ signature, value });
              setError('');
            }
          },
          (e) => {
            if (live) setError(String(e));
          },
        );
    }
    return () => {
      live = false;
    };
  }, [signature, revision]);
  return {
    data: state?.signature === signature ? state?.value : undefined,
    error,
  };
}
export const number = (n: number | null | undefined, digits = 0) =>
  n == null
    ? '–'
    : n.toLocaleString('de-AT', { maximumFractionDigits: digits });
export const bytes = (n: number) => number(n / (1024 * 1024), 2) + ' MiB';
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
