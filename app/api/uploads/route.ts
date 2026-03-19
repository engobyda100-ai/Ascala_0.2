import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ingestUploadedFile } from '@/lib/file-ingestion';
import type { UploadFilesResponse, UploadedContextFile } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files').filter((entry): entry is File => entry instanceof File);
    const clientFileIds = formData
      .getAll('clientFileIds')
      .map((value) => value.toString());

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files were uploaded.' }, { status: 400 });
    }

    const uploadedFiles = await Promise.allSettled(
      files.map((file, index) =>
        ingestUploadedFile({
          clientId: clientFileIds[index] || randomUUID(),
          file,
        })
      )
    );

    const response: UploadFilesResponse = {
      files: uploadedFiles.map((result, index): UploadedContextFile => {
        if (result.status === 'fulfilled') {
          return result.value;
        }

        return {
          id: clientFileIds[index] || randomUUID(),
          name: files[index].name,
          size: files[index].size,
          type: files[index].type,
          ingestionStatus: 'error',
          ingestionError:
            result.reason instanceof Error
              ? result.reason.message
              : 'File upload failed.',
        };
      }),
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown upload error';

    console.error('Upload ingestion failed:', error);

    return NextResponse.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}
