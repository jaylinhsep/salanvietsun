import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface R2Config {
  configured: boolean;
  accountId: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

export interface ExtractedContainerCandidate {
  container_no: string;
  seal_no: string;
  cont_type: '20E' | '20F' | '40E' | '40F';
  notes: string;
  confidence?: string;
}

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'tally');

export function ensureLocalTallyDir(): string {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
  return LOCAL_UPLOAD_DIR;
}

export function getR2Config(): R2Config {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || '').trim();
  const publicUrl = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  const endpointRaw = (
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
  )
    .trim()
    .replace(/\/+$/, '');

  const configured = Boolean(endpointRaw && accessKeyId && secretAccessKey && bucket);
  return {
    configured,
    accountId,
    endpoint: endpointRaw,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl,
  };
}

export function getAiConfig(overrideKey?: string): {
  configured: boolean;
  provider: 'gemini' | 'openai' | 'none';
  apiKey: string;
} {
  const override = (overrideKey || '').trim();
  if (override) {
    if (override.startsWith('sk-')) {
      return { configured: true, provider: 'openai', apiKey: override };
    }
    return { configured: true, provider: 'gemini', apiKey: override };
  }
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) return { configured: true, provider: 'gemini', apiKey: geminiKey };
  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (openaiKey) return { configured: true, provider: 'openai', apiKey: openaiKey };
  return { configured: false, provider: 'none', apiKey: '' };
}

function hmac(key: crypto.BinaryLike, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function encodeRfc3986Path(p: string): string {
  return p
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function buildAwsSigV4Headers(params: {
  method: 'GET' | 'PUT' | 'DELETE';
  endpoint: string;
  bucket: string;
  key: string;
  accessKeyId: string;
  secretAccessKey: string;
  body: Buffer | string;
  contentType?: string;
}): { url: string; headers: Record<string, string> } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const parsed = new URL(params.endpoint);
  const canonicalUri = `/${encodeURIComponent(params.bucket)}/${encodeRfc3986Path(params.key)}`;
  const payloadHash = sha256Hex(params.body);

  const canonicalHeadersMap: Record<string, string> = {
    host: parsed.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (params.contentType) {
    canonicalHeadersMap['content-type'] = params.contentType;
  }

  const sortedHeaderKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${canonicalHeadersMap[k]}\n`)
    .join('');
  const signedHeaders = sortedHeaderKeys.join(';');

  const canonicalRequest = [
    params.method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${params.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto
    .createHmac('sha256', kSigning)
    .update(stringToSign, 'utf8')
    .digest('hex');

  const authorization = `AWS4-HMAC-SHA256 Credential=${params.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `${params.endpoint}${canonicalUri}`,
    headers: {
      ...canonicalHeadersMap,
      Authorization: authorization,
    },
  };
}

export function decodeBase64DataUrl(dataUrl: string): {
  buffer: Buffer;
  mimeType: string;
  ext: string;
} {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (match) {
    const mimeType = match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    const ext = mimeType.includes('webp')
      ? 'webp'
      : mimeType.includes('png')
        ? 'png'
        : 'jpg';
    return { buffer, mimeType, ext };
  }
  const buffer = Buffer.from(String(dataUrl || ''), 'base64');
  return { buffer, mimeType: 'image/jpeg', ext: 'jpg' };
}

export async function uploadTallyImage(params: {
  photoId: string;
  voyageCodeOrId: string;
  buffer: Buffer;
  mimeType: string;
  ext: string;
}): Promise<{
  storage_provider: 'r2' | 'local';
  r2_key: string | null;
  image_url: string;
}> {
  const r2 = getR2Config();
  const safeVoyage = String(params.voyageCodeOrId || 'voyage')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 40);
  const key = `tally/${safeVoyage}/${params.photoId}.${params.ext}`;

  if (r2.configured) {
    const signed = buildAwsSigV4Headers({
      method: 'PUT',
      endpoint: r2.endpoint,
      bucket: r2.bucket,
      key,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      body: params.buffer,
      contentType: params.mimeType,
    });
    const res = await fetch(signed.url, {
      method: 'PUT',
      headers: signed.headers,
      body: new Uint8Array(params.buffer),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudflare R2 upload failed (${res.status}): ${text}`);
    }
    const imageUrl = r2.publicUrl
      ? `${r2.publicUrl}/${key}`
      : `/api/dispatch/tally-photos/${params.photoId}/image`;
    return {
      storage_provider: 'r2',
      r2_key: key,
      image_url: imageUrl,
    };
  }

  const dir = ensureLocalTallyDir();
  const filePath = path.join(dir, `${params.photoId}.${params.ext}`);
  fs.writeFileSync(filePath, params.buffer);
  return {
    storage_provider: 'local',
    r2_key: `${params.photoId}.${params.ext}`,
    image_url: `/api/dispatch/tally-photos/${params.photoId}/image`,
  };
}

export async function readTallyImageBinary(params: {
  photoId: string;
  storage_provider: string;
  r2_key?: string | null;
  mime_type?: string | null;
}): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const mimeType = params.mime_type || 'image/jpeg';
  if (params.storage_provider === 'r2' && params.r2_key) {
    const r2 = getR2Config();
    if (!r2.configured) return null;
    const signed = buildAwsSigV4Headers({
      method: 'GET',
      endpoint: r2.endpoint,
      bucket: r2.bucket,
      key: params.r2_key,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      body: '',
    });
    const res = await fetch(signed.url, { method: 'GET', headers: signed.headers });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return {
      buffer: Buffer.from(ab),
      mimeType: res.headers.get('content-type') || mimeType,
    };
  }

  const dir = ensureLocalTallyDir();
  const candidates = params.r2_key
    ? [path.join(dir, params.r2_key)]
    : [
        path.join(dir, `${params.photoId}.jpg`),
        path.join(dir, `${params.photoId}.webp`),
        path.join(dir, `${params.photoId}.png`),
      ];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) {
      return { buffer: fs.readFileSync(fp), mimeType };
    }
  }
  return null;
}

export async function deleteTallyImageBinary(params: {
  photoId: string;
  storage_provider: string;
  r2_key?: string | null;
}): Promise<void> {
  if (params.storage_provider === 'r2' && params.r2_key) {
    const r2 = getR2Config();
    if (r2.configured) {
      const signed = buildAwsSigV4Headers({
        method: 'DELETE',
        endpoint: r2.endpoint,
        bucket: r2.bucket,
        key: params.r2_key,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        body: '',
      });
      await fetch(signed.url, { method: 'DELETE', headers: signed.headers }).catch(() => {});
    }
    return;
  }

  const dir = ensureLocalTallyDir();
  const candidates = params.r2_key
    ? [path.join(dir, params.r2_key)]
    : [
        path.join(dir, `${params.photoId}.jpg`),
        path.join(dir, `${params.photoId}.webp`),
        path.join(dir, `${params.photoId}.png`),
      ];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
    }
  }
}

export function normalizeExtractedContainers(rawText: string): ExtractedContainerCandidate[] {
  let parsedArray: any[] | null = null;
  const cleanedJson = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const arrStart = cleanedJson.indexOf('[');
  const arrEnd = cleanedJson.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    try {
      const maybe = JSON.parse(cleanedJson.slice(arrStart, arrEnd + 1));
      if (Array.isArray(maybe)) parsedArray = maybe;
    } catch {
      parsedArray = null;
    }
  }

  const normalizeContType = (raw?: string): '20E' | '20F' | '40E' | '40F' => {
    const up = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (up === '20E' || up === '20MT' || up === '20EMPTY') return '20E';
    if (up === '40E' || up === '40MT' || up === '40EMPTY') return '40E';
    if (up === '40F' || up === '40HC' || up === '40GP' || up === '40DC' || up === '40FULL') return '40F';
    return '20F';
  };

  const results: ExtractedContainerCandidate[] = [];
  const seen = new Set<string>();

  if (parsedArray) {
    for (const item of parsedArray) {
      const rawNo = typeof item === 'string' ? item : item?.container_no || item?.cont_no || '';
      const contNo = String(rawNo)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .trim();
      if (!contNo || contNo.length < 7 || seen.has(contNo)) continue;
      seen.add(contNo);
      results.push({
        container_no: contNo,
        seal_no: String(item?.seal_no || item?.seal || '').toUpperCase().trim(),
        cont_type: normalizeContType(item?.cont_type || item?.size_type || item?.type),
        notes: String(item?.notes || item?.note || '').trim(),
        confidence: String(item?.confidence || 'HIGH'),
      });
    }
  }

  // Also scan raw text with ISO 6346 container regex as safety net
  const isoRegex = /\b([A-Z]{4}[-\s]?\d{6,7})\b/g;
  const upperRaw = rawText.toUpperCase();
  let m: RegExpExecArray | null;
  while ((m = isoRegex.exec(upperRaw)) !== null) {
    const contNo = m[1].replace(/[-\s]/g, '');
    if (!seen.has(contNo)) {
      seen.add(contNo);
      results.push({
        container_no: contNo,
        seal_no: '',
        cont_type: '20F',
        notes: '',
        confidence: 'MEDIUM',
      });
    }
  }

  return results;
}

export async function runAiContainerExtraction(params: {
  imageBuffer: Buffer;
  mimeType: string;
  overrideApiKey?: string;
}): Promise<{
  ai_configured: boolean;
  provider: string;
  raw_text: string;
  containers: ExtractedContainerCandidate[];
  message?: string;
}> {
  const ai = getAiConfig(params.overrideApiKey);
  if (!ai.configured) {
    return {
      ai_configured: false,
      provider: 'none',
      raw_text: '',
      containers: [],
      message:
        'Chưa cấu hình GEMINI_API_KEY hoặc OPENAI_API_KEY trong apps/api/.env (hoặc nhập key tạm thời trên màn hình để chạy AI ngay).',
    };
  }

  const prompt = [
    'Bạn là trợ lý nghiệp vụ cảng biển & vận tải thủy nội địa.',
    'Hãy đọc kỹ ảnh biên bản Tally / Phiếu giao nhận container này (có thể là chữ viết tay hoặc bản in).',
    'Trích xuất TOÀN BỘ danh sách số container xuất hiện trong ảnh.',
    'Chuẩn số container ISO 6346 gồm 4 chữ cái viết hoa + 7 chữ số (ví dụ: MSBU1514898, TCNU4821903). Bỏ dấu gạch ngang hoặc khoảng trắng thừa.',
    'Với mỗi container, hãy trả về JSON array đúng cấu trúc sau (CHỈ trả JSON array, không giải thích dài):',
    '[{"container_no":"MSBU1514898","seal_no":"SL12345","cont_type":"20F","notes":"","confidence":"HIGH"}]',
    'Quy ước cont_type chỉ nhận 1 trong 4 giá trị: "20E" (20 rỗng), "20F" (20 hàng), "40E" (40 rỗng), "40F" (40 hàng/HC). Nếu ảnh không ghi rõ loại cont thì mặc định "20F".',
  ].join('\n');

  const base64 = params.imageBuffer.toString('base64');

  if (ai.provider === 'gemini') {
    const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(ai.apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: params.mimeType || 'image/jpeg',
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1 },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error?.message || `Gemini API lỗi (${res.status})`);
    }
    const rawText =
      json?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text || '')
        .join('\n') || '';
    return {
      ai_configured: true,
      provider: `gemini (${model})`,
      raw_text: rawText,
      containers: normalizeExtractedContainers(rawText),
    };
  }

  // OpenAI Vision fallback
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${params.mimeType || 'image/jpeg'};base64,${base64}`,
              },
            },
          ],
        },
      ],
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `OpenAI API lỗi (${res.status})`);
  }
  const rawText = json?.choices?.[0]?.message?.content || '';
  return {
    ai_configured: true,
    provider: `openai (${model})`,
    raw_text: rawText,
    containers: normalizeExtractedContainers(rawText),
  };
}
