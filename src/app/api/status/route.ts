import { NextResponse } from 'next/server';
import { checkDockerStatus } from '@/lib/docker';

// Force dynamic execution since docker status should be evaluated at runtime
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dockerActive = await checkDockerStatus();
    return NextResponse.json({ dockerActive });
  } catch (error: any) {
    return NextResponse.json({ dockerActive: false, error: error.message }, { status: 500 });
  }
}
