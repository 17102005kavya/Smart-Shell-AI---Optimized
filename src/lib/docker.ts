import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

let cachedDockerStatus: boolean | null = null;

/**
 * Checks if the Docker CLI is available on the path and running.
 * Caches the result after the first check.
 */
export async function checkDockerStatus(): Promise<boolean> {
  if (cachedDockerStatus !== null) {
    return cachedDockerStatus;
  }

  try {
    // Attempt to run a lightweight docker CLI command
    await execAsync('docker --version', { timeout: 1500 });
    cachedDockerStatus = true;
  } catch (error) {
    console.warn('[Docker Check] Docker CLI is not available or running. Falling back to host execution.');
    cachedDockerStatus = false;
  }

  return cachedDockerStatus;
}
