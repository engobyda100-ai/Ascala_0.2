import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import type {
  FileIngestionStatus,
  UploadedContextFile,
} from '@/lib/types';

const execFileAsync = promisify(execFile);

const UPLOAD_ROOT = path.join(os.tmpdir(), 'ascala-intake-uploads');
const MAX_EXTRACTED_TEXT_CHARS = 5000;

const TEXT_FILE_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.yaml',
  '.yml',
]);

const TEXTUTIL_EXTENSIONS = new Set([
  '.doc',
  '.docx',
  '.rtf',
  '.odt',
]);

interface IngestUploadParams {
  clientId: string;
  file: File;
}

export async function ingestUploadedFile({
  clientId,
  file,
}: IngestUploadParams): Promise<UploadedContextFile> {
  const uploadId = randomUUID();
  const safeFileName = sanitizeFileName(file.name);
  const uploadDirectory = path.join(UPLOAD_ROOT, uploadId);
  const filePath = path.join(uploadDirectory, safeFileName);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  await fs.mkdir(uploadDirectory, { recursive: true });
  await fs.writeFile(filePath, fileBuffer);

  const extraction = await extractFileText({
    fileBuffer,
    fileName: file.name,
    filePath,
    mimeType: file.type,
  });

  return {
    id: clientId,
    uploadId,
    name: file.name,
    size: file.size,
    type: file.type,
    ingestionStatus: extraction.status,
    extractedText: extraction.extractedText,
    ingestionError: extraction.ingestionError,
  };
}

interface ExtractFileTextParams {
  fileBuffer: Buffer;
  fileName: string;
  filePath: string;
  mimeType: string;
}

async function extractFileText({
  fileBuffer,
  fileName,
  filePath,
  mimeType,
}: ExtractFileTextParams): Promise<{
  status: FileIngestionStatus;
  extractedText?: string;
  ingestionError?: string;
}> {
  const extension = path.extname(fileName).toLowerCase();

  try {
    if (TEXT_FILE_EXTENSIONS.has(extension) || mimeType.startsWith('text/')) {
      return buildParsedResult(fileBuffer.toString('utf8'));
    }

    if (TEXTUTIL_EXTENSIONS.has(extension)) {
      const { stdout } = await execFileAsync('/usr/bin/textutil', [
        '-convert',
        'txt',
        '-stdout',
        filePath,
      ]);

      return buildParsedResult(stdout);
    }

    if (extension === '.pdf') {
      const extractedText = await extractPdfText(filePath);

      if (extractedText) {
        return buildParsedResult(extractedText);
      }

      return {
        status: 'metadata-only',
        ingestionError: 'PDF text extraction was unavailable for this file.',
      };
    }

    return {
      status: 'metadata-only',
      ingestionError: 'This file type is stored, but text extraction is not supported yet.',
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Text extraction failed unexpectedly.';

    return {
      status: 'metadata-only',
      ingestionError: message,
    };
  }
}

async function extractPdfText(filePath: string) {
  try {
    await execFileAsync('/usr/bin/mdimport', [filePath]);
  } catch {
    // Spotlight import is best-effort only.
  }

  try {
    const { stdout } = await execFileAsync('/usr/bin/mdls', [
      '-raw',
      '-name',
      'kMDItemTextContent',
      filePath,
    ]);
    const normalized = normalizeExtractedText(stdout);

    if (!normalized || normalized === '(null)') {
      return '';
    }

    return normalized;
  } catch {
    return '';
  }
}

function buildParsedResult(rawText: string): {
  status: FileIngestionStatus;
  extractedText?: string;
  ingestionError?: string;
} {
  const extractedText = normalizeExtractedText(rawText);

  if (!extractedText) {
    return {
      status: 'metadata-only',
      ingestionError: 'No usable text could be extracted from this file.',
    };
  }

  return {
    status: 'parsed',
    extractedText,
  };
}

function normalizeExtractedText(rawText: string) {
  return rawText
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT_CHARS);
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
  return cleaned || 'upload';
}
