import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../apps/api/uploads/tally');

export function ensureLocalTallyDir() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
  return LOCAL_UPLOAD_DIR;
}

export function getR2Config() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim();
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || '').trim();
  const publicUrl = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  const endpoint = (
    process.env.R2_ENDPOINT ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
  )
    .trim()
    .replace(/\/+$/, '');

  return {
    configured: Boolean(endpoint && accessKeyId && secretAccessKey && bucket),
    accountId,
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl,
  };
}

export function getAiConfig(overrideKey) {
  const ov = (overrideKey || '').trim();
  if (ov) {
    return {
      configured: true,
      provider: ov.startsWith('sk-') ? 'openai' : 'gemini',
      apiKey: ov,
    };
  }
  const g = (process.env.GEMINI_API_KEY || '').trim();
  if (g) return { configured: true, provider: 'gemini', apiKey: g };
  const o = (process.env.OPENAI_API_KEY || '').trim();
  if (o) return { configured: true, provider: 'openai', apiKey: o };
  return { configured: false, provider: 'none', apiKey: '' };
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function buildAwsSigV4Headers({ method, endpoint, bucket, key, accessKeyId, secretAccessKey, body, contentType }) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const region = 'auto';
  const service = 's3';

  const parsed = new URL(endpoint);
  const encodedKey = key.split('/').map((s) => encodeURIComponent(s)).join('/');
  const canonicalUri = `/${encodeURIComponent(bucket)}/${encodedKey}`;
  const payloadHash = sha256Hex(body);

  const canonicalHeadersMap = {
    host: parsed.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) canonicalHeadersMap['content-type'] = contentType;

  const sortedKeys = Object.keys(canonicalHeadersMap).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${canonicalHeadersMap[k]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n');

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    url: `${endpoint}${canonicalUri}`,
    headers: {
      ...canonicalHeadersMap,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export function decodeBase64DataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/s);
  if (m) {
    const mimeType = m[1].toLowerCase();
    const buffer = Buffer.from(m[2], 'base64');
    const ext = mimeType.includes('webp') ? 'webp' : mimeType.includes('png') ? 'png' : 'jpg';
    return { buffer, mimeType, ext };
  }
  return { buffer: Buffer.from(String(dataUrl || ''), 'base64'), mimeType: 'image/jpeg', ext: 'jpg' };
}

export async function uploadTallyImage({ photoId, voyageCodeOrId, buffer, mimeType, ext }) {
  const r2 = getR2Config();
  const safeVoyage = String(voyageCodeOrId || 'voyage').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const key = `tally/${safeVoyage}/${photoId}.${ext}`;
  if (r2.configured) {
    const signed = buildAwsSigV4Headers({
      method: 'PUT',
      endpoint: r2.endpoint,
      bucket: r2.bucket,
      key,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      body: buffer,
      contentType: mimeType,
    });
    const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: new Uint8Array(buffer) });
    if (!res.ok) throw new Error(`Cloudflare R2 upload failed (${res.status})`);
    return {
      storage_provider: 'r2',
      r2_key: key,
      image_url: r2.publicUrl ? `${r2.publicUrl}/${key}` : `/api/dispatch/tally-photos/${photoId}/image`,
    };
  }
  const dir = ensureLocalTallyDir();
  fs.writeFileSync(path.join(dir, `${photoId}.${ext}`), buffer);
  return {
    storage_provider: 'local',
    r2_key: `${photoId}.${ext}`,
    image_url: `/api/dispatch/tally-photos/${photoId}/image`,
  };
}

export async function readTallyImageBinary({ photoId, storage_provider, r2_key, image_url, mime_type }) {
  const mimeType = mime_type || 'image/jpeg';
  if (storage_provider === 'r2') {
    const r2 = getR2Config();
    if (r2.configured && r2_key) {
      const signed = buildAwsSigV4Headers({
        method: 'GET',
        endpoint: r2.endpoint,
        bucket: r2.bucket,
        key: r2_key,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        body: '',
      });
      try {
        const res = await fetch(signed.url, { method: 'GET', headers: signed.headers });
        if (res.ok) {
          return { buffer: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get('content-type') || mimeType };
        }
      } catch {
        // fallback to public image_url
      }
    }
    if (image_url && /^https?:\/\//i.test(image_url)) {
      const pubRes = await fetch(image_url);
      if (pubRes.ok) {
        return { buffer: Buffer.from(await pubRes.arrayBuffer()), mimeType: pubRes.headers.get('content-type') || mimeType };
      }
    }
    return null;
  }
  const dir = ensureLocalTallyDir();
  const candidates = r2_key
    ? [path.join(dir, r2_key)]
    : [path.join(dir, `${photoId}.jpg`), path.join(dir, `${photoId}.webp`), path.join(dir, `${photoId}.png`)];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) return { buffer: fs.readFileSync(fp), mimeType };
  }
  return null;
}

export async function deleteTallyImageBinary({ photoId, storage_provider, r2_key }) {
  if (storage_provider === 'r2' && r2_key) {
    const r2 = getR2Config();
    if (r2.configured) {
      const signed = buildAwsSigV4Headers({
        method: 'DELETE',
        endpoint: r2.endpoint,
        bucket: r2.bucket,
        key: r2_key,
        accessKeyId: r2.accessKeyId,
        secretAccessKey: r2.secretAccessKey,
        body: '',
      });
      await fetch(signed.url, { method: 'DELETE', headers: signed.headers }).catch(() => {});
    }
    return;
  }
  const dir = ensureLocalTallyDir();
  const candidates = r2_key
    ? [path.join(dir, r2_key)]
    : [path.join(dir, `${photoId}.jpg`), path.join(dir, `${photoId}.webp`), path.join(dir, `${photoId}.png`)];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
}

export function normalizeExtractedContainers(rawText) {
  let parsedArray = null;
  const cleanedJson = String(rawText || '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
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
  const normType = (raw) => {
    const up = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (up === '20E' || up === '20MT' || up === '20EMPTY') return '20E';
    if (up === '40E' || up === '40MT' || up === '40EMPTY') return '40E';
    if (up === '40F' || up === '40HC' || up === '40GP' || up === '40DC' || up === '40FULL') return '40F';
    return '20F';
  };
  const results = [];
  const seen = new Set();
  if (parsedArray) {
    for (const item of parsedArray) {
      const rawNo = typeof item === 'string' ? item : item?.container_no || item?.cont_no || '';
      const contNo = String(rawNo).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
      if (!contNo || contNo.length < 7 || seen.has(contNo)) continue;
      seen.add(contNo);
      results.push({
        container_no: contNo,
        seal_no: String(item?.seal_no || item?.seal || '').toUpperCase().trim(),
        cont_type: normType(item?.cont_type || item?.size_type || item?.type),
        notes: String(item?.notes || item?.note || '').trim(),
        confidence: String(item?.confidence || 'HIGH'),
      });
    }
  }
  const isoRegex = /\b([A-Z]{4}[-\s]?\d{6,7})\b/g;
  const upperRaw = String(rawText || '').toUpperCase();
  let m;
  while ((m = isoRegex.exec(upperRaw)) !== null) {
    const contNo = m[1].replace(/[-\s]/g, '');
    if (!seen.has(contNo)) {
      seen.add(contNo);
      results.push({ container_no: contNo, seal_no: '', cont_type: '20F', notes: '', confidence: 'MEDIUM' });
    }
  }
  return results;
}

export async function runAiContainerExtraction({ imageBuffer, mimeType, overrideApiKey }) {
  const ai = getAiConfig(overrideApiKey);
  if (!ai.configured) {
    return {
      ai_configured: false,
      provider: 'none',
      raw_text: '',
      containers: [],
      message: 'Chưa cấu hình GEMINI_API_KEY hoặc OPENAI_API_KEY trong apps/api/.env (hoặc nhập key tạm thời trên màn hình để chạy AI ngay).',
    };
  }
  const prompt = [
    'Bạn là trợ lý nghiệp vụ cảng biển & vận tải thủy nội địa.',
    'Hãy đọc kỹ ảnh biên bản Tally / Phiếu giao nhận container này (có thể là chữ viết tay hoặc bản in).',
    'Trích xuất TOÀN BỘ danh sách số container xuất hiện trong ảnh.',
    'Chuẩn số container ISO 6346 gồm 4 chữ cái viết hoa + 7 chữ số (ví dụ: MSBU1514898). Bỏ dấu gạch ngang hoặc khoảng trắng thừa.',
    'Với mỗi container, hãy trả về JSON array đúng cấu trúc sau (CHỈ trả JSON array):',
    '[{"container_no":"MSBU1514898","seal_no":"SL12345","cont_type":"20F","notes":"","confidence":"HIGH"}]',
    'Quy ước cont_type chỉ nhận: "20E", "20F", "40E", "40F". Nếu không rõ mặc định "20F".',
  ].join('\n');
  const base64 = imageBuffer.toString('base64');

  if (ai.provider === 'gemini') {
    const candidateModels = Array.from(
      new Set([process.env.GEMINI_VISION_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'].map((m) => String(m || '').trim()).filter(Boolean)),
    );
    let lastErrMsg = 'Gemini API lỗi không xác định.';
    for (const model of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(ai.apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType || 'image/jpeg', data: base64 } }] }],
          generationConfig: { temperature: 0.1 },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const rawText = json?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('\n') || '';
        return { ai_configured: true, provider: `gemini (${model})`, raw_text: rawText, containers: normalizeExtractedContainers(rawText) };
      }
      const errMsg = json?.error?.message || `Gemini API lỗi (${res.status})`;
      lastErrMsg = `[${model}] ${errMsg}`;
      const isModelUnavailable = res.status === 404 || /not found|not supported|deprecated|no longer available/i.test(errMsg);
      if (!isModelUnavailable) throw new Error(lastErrMsg);
    }
    throw new Error(lastErrMsg);
  }

  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}` } }] }],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `OpenAI API lỗi (${res.status})`);
  const rawText = json?.choices?.[0]?.message?.content || '';
  return { ai_configured: true, provider: `openai (${model})`, raw_text: rawText, containers: normalizeExtractedContainers(rawText) };
}
