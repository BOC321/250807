// pages/api/reports/generate.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import fs from 'node:fs';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// -----------------------------
// Utilities
// -----------------------------

function getBaseUrl(req: NextApiRequest): string {
  const hdr = req.headers?.origin?.toString().replace(/\/$/, '');
  if (hdr) return hdr;

  const fromEnv = (process.env['NEXT_PUBLIC_SITE_URL'] || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const fromVercel = process.env['VERCEL_URL'] ? `https://${process.env['VERCEL_URL']}` : '';
  if (fromVercel) return fromVercel;

  return 'http://localhost:3000';
}

function findLocalChromeExecutable(): string | null {
  const candidates = [
    process.env['PUPPETEER_EXECUTABLE_PATH'],
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

async function launchBrowser() {
  // 1) Local full Puppeteer (if available)
  try {
    const puppeteer = await import('puppeteer');
    // eslint-disable-next-line no-console
    console.log('[generate] Using full puppeteer');
    return await puppeteer.default.launch({
      headless: true,
    });
  } catch {
    // ignore — continue to next option
  }

  // 2) puppeteer-core + local Chrome/Edge
  const localExe = findLocalChromeExecutable();
  if (localExe) {
    // eslint-disable-next-line no-console
    console.log('[generate] Using puppeteer-core with local Chrome/Edge at', localExe);
    return await puppeteerCore.launch({
      executablePath: localExe,
      headless: true,
    });
  }

  // 3) Last resort: serverless chromium
  const executablePath = await chromium.executablePath();
  // eslint-disable-next-line no-console
  console.log('[generate] Using @sparticuz/chromium at', executablePath);
  return await puppeteerCore.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function averagePercent(map: Record<string, number>): number {
  const values = Object.values(map).filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pickRange(
  pct: number,
  ranges: Array<{ min_score?: number; max_score?: number; description?: string; color?: string }>
) {
  const n = Number(pct ?? 0);
  for (const r of ranges || []) {
    const min = Number(r?.min_score ?? 0);
    const max = Number(r?.max_score ?? 100);
    if (n >= min && n <= max) return r;
  }
  return null;
}

// -----------------------------
// Supabase (server-side)
// -----------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY as string) ||
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
const supabase = createClient(supabaseUrl, supabaseKey);

// -----------------------------
// HTML builders
// -----------------------------
function buildHtmlReport(params: {
  surveyTitle: string;
  generatedAt: string;
  categoryPercents: Record<string, number>;
  totalPercent: number;
  totalRange?: any | null;
  categoryRangesByTitle?: Record<string, any | null>;
  userResponses?: Record<string, string>;
}) {
  const {
    surveyTitle,
    generatedAt,
    categoryPercents,
    totalPercent,
    totalRange,
    categoryRangesByTitle = {},
    userResponses = {},
  } = params;

  const catRows = Object.entries(categoryPercents)
    .map(([name, pct]) => {
      const range = categoryRangesByTitle[name] || null;
      const desc = range?.description ? escapeHtml(range.description) : '';
      const color = range?.color || '#999';
      const leftBar = `border-left:4px solid ${color}; background:#f8f9fa;`;
      return `
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">
            <div style="font-weight:600;">${escapeHtml(name)}</div>
            ${desc ? `<div style="${leftBar} padding:6px 10px; margin-top:6px;">${desc}</div>` : ''}
          </td>
          <td style="padding:8px; border:1px solid #ddd; text-align:right;">
            ${Number(pct).toFixed(2)}%
          </td>
        </tr>`;
    })
    .join('');

  const totalDesc = totalRange?.description
    ? `<div style="margin-top:8px; padding:8px 12px; border-left:4px solid ${totalRange?.color || '#999'}; background:#f8f9fa;">${escapeHtml(totalRange.description)}</div>`
    : '';

  const details =
    userResponses && Object.keys(userResponses).length > 0
      ? `
  <h2 style="margin-top:24px;">Your Responses</h2>
  <table style="width:100%; border-collapse:collapse;">
    <thead>
      <tr>
        <th style="padding:8px; border:1px solid #ddd; text-align:left;">Question ID</th>
        <th style="padding:8px; border:1px solid #ddd; text-align:left;">Answer</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(userResponses)
        .map(([qid, val]) => {
          const v = Array.isArray(val) ? val.join(', ') : val == null ? '' : String(val);
          return `
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(qid)}</td>
          <td style="padding:8px; border:1px solid #ddd;">${escapeHtml(v)}</td>
        </tr>`;
        })
        .join('')}
    </tbody>
  </table>`
      : '';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(surveyTitle)} — Report</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#111; padding: 0 14mm 18mm 14mm; }
    h1, h2, h3 { line-height: 1.2; }
    table { border-collapse: collapse; width: 100%; }
    th, td { font-size: 14px; }
    section { page-break-inside: avoid; }
  </style>
</head>
<body>
  <section style="page-break-inside: avoid; padding: 30px 0 10px 0;">
    <h1 style="margin:0 0 6px 0;">${escapeHtml(surveyTitle)}</h1>
    <div style="color:#555;">${escapeHtml(generatedAt)}</div>
  </section>

  <section style="margin-top:12px;">
    <h2 style="margin:0 0 8px 0;">Summary</h2>
    <div style="font-size:22px; font-weight:700;">${Number(totalPercent).toFixed(2)}%</div>
    ${totalDesc}
  </section>

  <section style="margin-top:16px;">
    <h2 style="margin:0 0 8px 0;">Category scores</h2>
    <table>
      <thead>
        <tr>
          <th style="text-align:left; padding:8px; border:1px solid #ddd; background:#f7f7f7;">Category</th>
          <th style="text-align:right; padding:8px; border:1px solid #ddd; background:#f7f7f7;">Score</th>
        </tr>
      </thead>
      <tbody>${catRows}</tbody>
    </table>
  </section>

  ${details}
</body>
</html>`;
}

// -----------------------------
// Route
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Preflight for CORS, if needed
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).end();
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (!req.headers['content-type']?.toString().includes('application/json')) {
      res.status(415).json({ error: 'Unsupported Media Type', required: 'application/json' });
      return;
    }

    const body = req.body || {};
    const { surveyId, respondentId, email, categoryScores, userResponses } = body as {
      surveyId?: string;
      respondentId?: string;
      email?: string;
      categoryScores?: Record<string, number>;
      userResponses?: Record<string, string>;
    };

    if (!surveyId || !respondentId || !email) {
      res.status(400).json({
        error: 'Missing required fields',
        requiredFields: ['surveyId', 'respondentId', 'email'],
      });
      return;
    }

    const baseUrl = getBaseUrl(req);

    // Fetch survey
    const { data: survey, error: sErr } = await supabase
      .from('surveys')
      .select('id, title')
      .eq('id', surveyId)
      .single();
    if (sErr || !survey) {
      res.status(404).json({ error: 'Survey not found' });
      return;
    }

    // Score ranges
    const { data: catRanges, error: r1 } = await supabase
      .from('score_ranges')
      .select('*')
      .eq('survey_id', surveyId)
      .not('category_id', 'is', null);
    if (r1) throw r1;

    const { data: totRanges, error: r2 } = await supabase
      .from('score_ranges')
      .select('*')
      .eq('survey_id', surveyId)
      .is('category_id', null);
    if (r2) throw r2;

    // Fetch categories to map title -> id
    const { data: cats, error: cErr } = await supabase
      .from('categories')
      .select('id, title')
      .eq('survey_id', surveyId);
    if (cErr) throw cErr;

    const titleToId = new Map((cats || []).map((c: any) => [c.title, c.id]));
    const rangesByCatId: Record<string, any[]> = {};
    for (const r of catRanges || []) {
      const cid = r.category_id;
      if (!cid) continue;
      (rangesByCatId[cid] ||= []).push(r);
    }

    // Use provided categoryScores as-is
    const trustedCategoryPercents: Record<string, number> =
      categoryScores && typeof categoryScores === 'object' ? categoryScores : {};

    // Per-category band text
    const categoryRangesByTitle: Record<string, any | null> = {};
    for (const [title, pct] of Object.entries(trustedCategoryPercents)) {
      const cid = titleToId.get(title);
      const ranges = cid ? rangesByCatId[cid] || [] : [];
      categoryRangesByTitle[title] = pickRange(pct, ranges);
    }

    const totalPercent =
      Object.keys(trustedCategoryPercents).length > 0 ? averagePercent(trustedCategoryPercents) : 0;
    const totalRange = pickRange(totalPercent, totRanges || []);

    const html = buildHtmlReport({
      surveyTitle: survey.title || 'Survey',
      generatedAt: new Date().toLocaleString(),
      categoryPercents: trustedCategoryPercents,
      totalPercent,
      totalRange,
      categoryRangesByTitle,
      userResponses: userResponses || {},
    });

    // Generate PDF
    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
    });
    await browser.close();

    // ---------- Upload to Supabase Storage (bucket from env) ----------
    const bucket = process.env.SUPABASE_REPORTS_BUCKET || 'survey-reports';
    const fileName = `report-${surveyId}-${respondentId}-${uuidv4()}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from(bucket)
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
        cacheControl: '0',
      });
    if (uploadErr) throw new Error(`PDF upload failed: ${uploadErr.message}`);

    // Keep your existing /api/reports/serve flow intact
    const serveUrl = `${baseUrl}/api/reports/serve?fileName=${encodeURIComponent(fileName)}`;

    // Save the URL and email on the respondent (best-effort)
    const { error: updErr } = await supabase
      .from('respondents')
      .update({ report_url: serveUrl, email })
      .eq('id', respondentId);
    if (updErr) {
      // eslint-disable-next-line no-console
      console.warn('Could not save report_url to respondent:', updErr.message);
    }

    // Send email (best-effort)
let emailSent = false;
let emailMessage = '';

if (process.env.MAIL_HOST) {
  try {
    const secure =
      String(process.env.MAIL_SECURE || '').toLowerCase() === 'true' ||
      Number(process.env.MAIL_PORT) === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT || (secure ? 465 : 587)),
      secure,
      auth:
        process.env.MAIL_USER && process.env.MAIL_PASS
          ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
          : undefined,
    });

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@example.com',
      to: email,
      subject: `Your report for ${survey?.title || 'Survey'}`,
      html: `
        <p>Hi,</p>
        <p>Your PDF report is ready. You can download it here:</p>
        <p><a href="${serveUrl}">${serveUrl}</a></p>
        <p>Thanks!</p>
      `,
    });

    emailSent = !!info?.messageId;
    emailMessage = emailSent ? 'Email sent.' : 'Email not confirmed sent.';
  } catch (e: any) {
    // keep report generation successful even if email fails
    // eslint-disable-next-line no-console
    console.error('Email send failed (continuing):', e);
    emailMessage = `Email failed: ${e?.message || 'unknown error'}`;
  }
} else {
  // No SMTP configured — skip cleanly
  emailMessage = 'Email skipped: MAIL_HOST not set.';
}


    res.status(200).json({ success: true, serveUrl, emailSent, emailMessage });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Error generating report:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
