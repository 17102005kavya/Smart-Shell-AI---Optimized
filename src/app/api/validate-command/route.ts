import { NextResponse } from 'next/server';

const DANGEROUS_PATTERNS = [
  /rm\s+-r.*f/,
  /rm\s+-f.*r/,
  />\s*\/dev\/sd/,
  /mkfs/,
  /shutdown/,
  /reboot/,
  /:\(\)\{.*:\|:&\};:/, // fork bomb
  /mv\s+.*\/dev\/null/,
  /chmod\s+-R\s+777/
];

const WARNING_PATTERNS = [
  /rm\s+/,
  /kill/,
  /pkill/,
  /killall/,
  /drop/,
  /sudo/
];

export async function POST(req: Request) {
  try {
    const { command } = await req.json();
    
    let safety = 'SAFE';

    // Heuristics Check First
    if (DANGEROUS_PATTERNS.some(p => p.test(command))) {
      safety = 'DANGEROUS';
    } else if (WARNING_PATTERNS.some(p => p.test(command))) {
      safety = 'WARNING';
    }

    // Optional: We could also ask AI to validate, but a regex list is faster and more deterministic for obvious threats.
    
    return NextResponse.json({ safety });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
