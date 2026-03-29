import { NextRequest, NextResponse } from 'next/server';
import { generatePersonas } from '@/lib/gemini';
import type {
  PersonaGenerationRequest,
  PersonaGenerationResponse,
} from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: PersonaGenerationRequest = await req.json();
    const personaCount = body.personaCount;

    if (!body.targetMarket?.trim()) {
      return NextResponse.json(
        { error: 'targetMarket is required.' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(personaCount) || personaCount < 3 || personaCount > 10) {
      return NextResponse.json(
        { error: 'personaCount must be an integer between 3 and 10.' },
        { status: 400 }
      );
    }

    const personas = await generatePersonas(body.targetMarket, {
      attachedFiles: body.attachedFiles || [],
      inputMode: body.inputMode,
      intakeSummary: body.intakeSummary,
      personaCount,
      productContext: body.productContext,
      structuredIntake: body.structuredIntake,
    });

    const response: PersonaGenerationResponse = {
      personas,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Persona generation failed:', error);

    return NextResponse.json(
      { error: `Persona generation failed: ${message}` },
      { status: 500 }
    );
  }
}
