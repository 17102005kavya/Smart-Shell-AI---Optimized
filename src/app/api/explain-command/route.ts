import { NextResponse } from 'next/server';
import { explainCommandWithRetry } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { command } = await req.json();
    
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return NextResponse.json({ explanation: `This is a mock explanation for '${command}'. It would normally describe the flags and actions.` });
    }

    const explanation = await explainCommandWithRetry(command);
    return NextResponse.json({ explanation });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
