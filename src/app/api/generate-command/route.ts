import { NextResponse } from 'next/server';
import { generateCommandWithRetry } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      // Mock mode
      console.warn("No Gemini API key found. Using mock response.");
      let cmd = 'echo "API key not configured"';
      const lowerPrompt = prompt.toLowerCase();
      if (lowerPrompt.includes('list') || lowerPrompt.includes('show')) cmd = 'ls -la';
      if (lowerPrompt.includes('delete') || lowerPrompt.includes('remove')) cmd = 'rm -rf ./temp';
      return NextResponse.json({ command: cmd });
    }

    const command = await generateCommandWithRetry(prompt);
    return NextResponse.json({ command });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
