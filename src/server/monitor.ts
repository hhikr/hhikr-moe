// The site's standing watch: a reading of the machine every minute. Started
// with the first request the server handles, and never kept alive for: the
// timer does not hold the process open.
import { recordVpsSample } from './vps.ts';

let started = false;

export function startMonitor(): void {
  if (started) return;
  started = true;

  const sample = () => {
    try {
      recordVpsSample();
    } catch (error) {
      console.error('could not record a reading of the machine', error);
    }
  };
  sample();
  setInterval(sample, 60_000).unref();
}
