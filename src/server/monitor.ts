// The site's two standing watches: a reading of the machine every minute, and
// a look at Hermes every ten. Started with the first request the server
// handles, and never kept alive for: the timers do not hold the process open.
import { syncHermes } from './hermes.ts';
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

  void syncHermes();
  setInterval(() => void syncHermes(), 600_000).unref();
}
