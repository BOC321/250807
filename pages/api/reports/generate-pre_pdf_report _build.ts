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
  // Prefer the browser-provided origin when available
  const hdr = req.headers?.origin?.toString().replace(/\/$/, '');
  if (hdr) return hdr;

  // Fallbacks for server contexts
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

/**
 * Launch a browser in this order:
 *  1) full puppeteer (bundled Chromium) — ideal for local dev
 *  2) puppeteer-core + local Chrome/Edge
 *  3) @sparticuz/chromium — for serverless (Vercel/Lambda)
 */
async function launchBrowser() {
  // 1) Try full Puppeteer (bundled Chromium)
  try {
    const puppeteer = (await import('puppeteer')).default;
    // eslint-disable-next-line no-console
    console.log('[generate] Using full puppeteer (bundled Chromium)');
    return await puppeteer.launch({ headless: true });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.log('[generate] Full puppeteer not available:', e?.message || e);
  }

  // 2) Try puppeteer-core with a local Chrome/Edge
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
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

function pickRange(pct: number, ranges: any[]): any | null {
  // Ranges table is expected to be on a 0..100 scale (min_score/max_score)
  if (!Array.isArray(ranges)) return null;
  for (const r of ranges) {
    const min = Number(r?.min_score ?? 0);
    const max = Number(r?.max_score ?? 100);
    if (pct >= min && pct <= max) return r;
  }
  return null;
}

// Build the PDF HTML.
// categoryPercents: { "Category Title": 0..100 }
// totalPercent: 0..100
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
      const desc = range?.description ? `<div style="color:#444; font-size:13px; margin-top:4px;">${escapeHtml(range.description)}</div>` : '';
      const leftBar = range?.color ? `border-left:4px solid ${range.color}; background:#f8f9fa;` : '';
      return `
        <tr>
          <td style="padding:8px; border:1px solid #ddd;">
            <div style="font-weight:600;">${escapeHtml(name)}</div>
            ${desc ? `<div style="${leftBar} padding:6px 10px; margin-top:6px;">${desc}</div>` : ''}
          </td>
          <td style="padding:8px; border:1px solid #ddd; text-align:right;">
            ${pct.toFixed(2)}%
          </td>
        </tr>`;
    })
    .join('');

  const totalDesc = totalRange?.description
    ? `<div style="margin-top:8px; padding:8px 12px; border-left:4px solid ${totalRange.color || '#999'}; background:#f8f9fa;">${escapeHtml(totalRange.description)}</div>`
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
  <title>${escapeHtml(surveyTitle)} — Survey Report</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #222;">
  <h1 style="margin-bottom: 4px;">Survey Report</h1>
  <div style="color:#666; margin-bottom: 16px;">
    <div><strong>${escapeHtml(surveyTitle)}</strong></div>
    <div>Generated: ${generatedAt}</div>
  </div>

  <h2>Total Score</h2>
  <div style="font-size: 18px; font-weight: 600;">${totalPercent.toFixed(2)}%</div>
  ${totalDesc}

  <h2 style="margin-top:24px;">Category Scores</h2>
  <table style="width:100%; border-collapse: collapse;">
    <thead>
      <tr>
        <th style="padding: 8px; border: 1px solid #ddd; text-align:left;">Category</th>
        <th style="padding: 8px; border: 1px solid #ddd; text-align:right;">Score</th>
      </tr>
    </thead>
    <tbody>
      ${catRows}
    </tbody>
  </table>

  ${details}
</body>
</html>`;
}

// -----------------------------
// Email service (best-effort)
// -----------------------------
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const user = process.env['GMAIL_EMAIL'];
  const pass = process.env['GMAIL_APP_PASSWORD'];

  if (!user || !pass) {
    // Not fatal for API: we still return the serveUrl and let the UI show it
    return { ok: false, reason: 'Gmail credentials missing' as const };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const info = await transporter.sendMail({ from: user, to, subject, html });
  return { ok: true as const, messageId: info.messageId };
}

// -----------------------------
// Supabase helper
// -----------------------------
function getSupabaseServerClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) throw new Error('Missing Supabase URL or service role key.');
  return createClient(url, key);
}

// -----------------------------
// API handler
// -----------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS preflight if needed
  if (req.method === 'OPTIONS') {
    res.status(200).end();
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
    categoryScores?: Record<string, number>; // { "Category Title": 0..100 }
    userResponses?: Record<string, string>;  // { [questionId]: "value" }
  };

  if (!surveyId || !respondentId || !email) {
    res.status(400).json({
      error: 'Missing required fields',
      requiredFields: ['surveyId', 'respondentId', 'email'],
    });
    return;
  }

  const supabase = getSupabaseServerClient();
  const baseUrl = getBaseUrl(req);

  try {
    // Survey title
    const { data: survey, error: sErr } = await supabase
      .from('surveys')
      .select('id, title')
      .eq('id', surveyId)
      .single();
    if (sErr || !survey) throw new Error(sErr?.message || 'Could not load survey');

    // Categories for mapping titles -> ids
    const { data: cats, error: cErr } = await supabase
      .from('categories')
      .select('id, title')
      .eq('survey_id', surveyId);
    if (cErr) throw cErr;

    const titleToId = new Map<string, string>();
    (cats || []).forEach((c) => titleToId.set(c.title, c.id));

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

    // Resolve per-category range by title
    const rangesByCatId: Record<string, any[]> = {};
    for (const r of catRanges || []) {
      const cid = r.category_id;
      if (!cid) continue;
      (rangesByCatId[cid] ||= []).push(r);
    }

    const trustedCategoryPercents: Record<string, number> =
      categoryScores && typeof categoryScores === 'object' ? categoryScores : {};

    const categoryRangesByTitle: Record<string, any | null> = {};
    for (const [title, pct] of Object.entries(trustedCategoryPercents)) {
      const cid = titleToId.get(title);
      const ranges = cid ? rangesByCatId[cid] || [] : [];
      categoryRangesByTitle[title] = pickRange(pct, ranges);
    }

    const totalPercent =
      Object.keys(trustedCategoryPercents).length > 0 ? averagePercent(trustedCategoryPercents) : 0;
    const totalRange = pickRange(totalPercent, totRanges || []);

    // Build HTML
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

    // Upload to Supabase Storage (bucket: survey-reports)
    const fileName = `report-${surveyId}-${respondentId}-${uuidv4()}.pdf`;
    const { error: uploadErr } = await supabase
      .storage
      .from('survey-reports')
      .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: false, cacheControl: '0' });
    if (uploadErr) throw new Error(`PDF upload failed: ${uploadErr.message}`);

    // Build serve URL (your API proxy that reads from storage)
    const serveUrl = `${baseUrl}/api/reports/serve?fileName=${encodeURIComponent(fileName)}`;

    // Save the URL and email on the respondent (best-effort)
    const { error: updErr } = await supabase
      .from('respondents')
      .update({ report_url: serveUrl, email })
      .eq('id', respondentId);
    if (updErr) {
      // eslint-disable-next-line no-console
      console.error('Warning: failed to update respondent with report_url:', updErr);
    }

    // Send email (best-effort)
    let emailSent = false;
    let emailMessage = '';
    try {
      const emailRes = await sendEmail({
        to: email,
        subject: 'Your Survey Report',
        html: `
          <p>Hello,</p>
          <p>Your report for <strong>${escapeHtml(survey.title || 'Survey')}</strong> is ready.</p>
          <p><a href="${serveUrl}">View / Download your PDF report</a></p>
          <p>If the button doesn’t work, copy this URL into your browser:</p>
          <p style="word-break:break-all;"><code>${serveUrl}</code></p>
          <p>Thanks!</p>
        `,
      });
      emailSent = !!emailRes.ok;
      emailMessage = emailRes.ok ? 'Email sent' : emailRes.reason || 'Email not sent';
    } catch (e: any) {
      emailSent = false;
      emailMessage = e?.message || 'Email error';
    }

    res.status(200).json({ success: true, serveUrl, emailSent, emailMessage });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('Error generating report:', err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
