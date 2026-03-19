import { NextRequest, NextResponse } from 'next/server';
import { generateIntakeCoachResponse } from '@/lib/gemini';
import type { ChatAgentRequest, ChatAgentResponse } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: ChatAgentRequest = await req.json();

    if (!body.recentMessages || body.recentMessages.length === 0) {
      return NextResponse.json(
        { error: 'At least one recent chat message is required.' },
        { status: 400 }
      );
    }

    const response: ChatAgentResponse = await generateIntakeCoachResponse(body);

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Intake chat failed:', error);

    return NextResponse.json(
      { error: `Chat failed: ${message}` },
      { status: 500 }
    );
  }
}
