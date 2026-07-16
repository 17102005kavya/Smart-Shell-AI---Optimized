import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import { checkDockerStatus } from '@/lib/docker';

const execAsync = util.promisify(exec);

export async function POST(req: Request) {
  try {
    const { command } = await req.json();

    if (!command) {
      return NextResponse.json({ error: "No command provided" }, { status: 400 });
    }

    const dockerActive = await checkDockerStatus();
    let runCommand = '';
    let isFallback = false;

    if (dockerActive) {
      // Escape double quotes in the command to pass to sh -c safely inside Docker
      const escapedCommand = command.replace(/"/g, '\\"');
      runCommand = `docker run --rm --network none --memory 128m alpine sh -c "${escapedCommand}"`;
    } else {
      // Run directly in the host shell environment (node exec executes inside cmd.exe on Windows, sh on Unix)
      runCommand = command;
      isFallback = true;
    }

    try {
      const { stdout, stderr } = await execAsync(runCommand, {
        timeout: 10000, // 10 second timeout
        maxBuffer: 1024 * 1024, // 1MB output limit
      });

      return NextResponse.json({ 
        stdout: stdout || null, 
        stderr: stderr || null,
        isFallback
      });
    } catch (execError: any) {
      return NextResponse.json({ 
        error: execError.message || "Command execution failed",
        stdout: execError.stdout || null,
        stderr: execError.stderr || null,
        isFallback
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
