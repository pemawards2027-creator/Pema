import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AdminDepartmentRole,
  AwardeeGalleryItem,
  ChatMessage,
  ChatThread,
  ContactInquiry,
  DepartmentAccessRole,
  EvaluatorRecommendation,
  EvaluatorSlot,
  LegitimacyCredential,
  LiveWebsiteContent,
  NominationEvaluationScore,
  NominationRecord,
  NominationStatus,
  PaymentRecord,
  PaymentStatus,
  ProjectFundingRecord,
  ProjectFundingStatus,
  ProjectFundingType,
  PublicPasskeyDevice,
  SimulatedEmailNotification,
  UploadedFileRef,
  UserAccount,
  UserPasskeyCredential,
} from './src/types/pema';
import {
  parsePasskeyDeviceLabel,
  resolveWebAuthnRpAndOrigin,
} from './src/utils/biometricAuth';
import {
  DEPARTMENT_ROLE_CATALOG,
  EVALUATOR_SLOTS,
  MAX_CHAT_ATTACHMENTS,
  NOMINATION_CATEGORY_CLUSTERS,
  NOMINATION_EVALUATION_CRITERIA,
  buildNominationStatusEmail,
  canRoleClearFundingFinance,
  canRoleDecideNomination,
  canRoleMutateFunding,
  canRoleMutatePayments,
  canRoleScoreEvaluatorSlot,
  generateReferenceCode,
  isValidDepartmentAccessRole,
  normalizeAuthorizedAdminName,
  normalizeCriteriaScores,
  parseLiveBundleContent,
  validateChatIntake,
  validateNominationForm,
} from './src/utils/pemaRules';
import {
  UPLOADS_DIR,
  type PemaDatabase,
  type StoredUser,
  hashPassword,
  loadDb,
  popAdminRevision,
  pushAdminRevision,
  saveBase64Upload,
  saveDb,
  verifyPassword,
} from './server/store';

const ADMIN_PASSWORD = process.env.PEMA_ADMIN_PASSWORD || 'PEMA2027!';
const LIVE_SITE_URL = 'https://awards-pema--8elhlw9i.preview.emergentagent.com';

interface LiveCache {
  fetchedAt: number;
  liveSyncOk: boolean;
  syncStatusMessage: string;
  parsed: ReturnType<typeof parseLiveBundleContent>;
}

let liveCache: LiveCache | null = null;
const LIVE_CACHE_TTL_MS = 60_000;

async function fetchLiveWebsiteSnippet(forceRefresh = false): Promise<LiveCache> {
  const now = Date.now();
  if (!forceRefresh && liveCache && now - liveCache.fetchedAt < LIVE_CACHE_TTL_MS) {
    return liveCache;
  }

  try {
    const htmlRes = await fetch(LIVE_SITE_URL, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'PEMA-Portal-Sync/1.0' },
    });
    if (!htmlRes.ok) {
      throw new Error(`HTTP ${htmlRes.status}`);
    }
    const html = await htmlRes.text();
    const scriptMatches = Array.from(html.matchAll(/src="([^"]*(?:bundle|index|main)[^"]*\.js)"/g));
    let bundlePath = '/static/js/bundle.js';
    for (const m of scriptMatches) {
      if (m[1].startsWith('/')) {
        bundlePath = m[1];
        break;
      }
    }

    const bundleUrl = `${LIVE_SITE_URL}${bundlePath}`;
    const bundleRes = await fetch(bundleUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'PEMA-Portal-Sync/1.0' },
    });
    if (!bundleRes.ok) {
      throw new Error(`Bundle HTTP ${bundleRes.status}`);
    }
    const bundleJs = await bundleRes.text();
    const parsed = parseLiveBundleContent(bundleJs);

    liveCache = {
      fetchedAt: now,
      liveSyncOk: true,
      syncStatusMessage: `Synchronized live from ${LIVE_SITE_URL}`,
      parsed,
    };
    return liveCache;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network unreachable';
    const fallback: LiveCache = {
      fetchedAt: now,
      liveSyncOk: false,
      syncStatusMessage: `Using cached official PEMA baseline (${message})`,
      parsed: liveCache?.parsed ?? {},
    };
    return fallback;
  }
}

function buildLiveContent(cache: LiveCache): LiveWebsiteContent {
  const db = loadDb();
  const aboutArr = cache.parsed.about ?? [
    'About PEMA',
    'A standard worth reaching for.',
    'PEMA exists to spotlight the Filipinos and Filipino-led organizations whose work creates lasting impact. Our awards are designed as a thoughtful, credible celebration of merit — across business, culture, community, and innovation.',
    'We believe recognition should open doors, strengthen purpose, and inspire the next generation.',
  ];
  const servicesArr = cache.parsed.services ?? [
    'Our services',
    'More than an award. A platform.',
    'From a considered nomination experience to a polished awards program, PEMA helps exceptional work receive the attention it deserves.',
    'Our programs are designed to connect achievement with opportunity.',
  ];
  const pricingArr = cache.parsed.pricing ?? [
    'Pricing',
    'Your achievement, thoughtfully presented.',
    'Award and program fees are being finalized by the PEMA organizing committee. We’ll publish confirmed rates here as soon as they are approved.',
    'Confirm award fee · Confirm inclusions · Confirm payment deadline',
  ];
  const baseFaqQuestions = cache.parsed.faqQuestions ?? [
    'Who can be nominated?',
    'How does the nomination process work?',
    'When will fees be confirmed?',
    'Can organizations nominate someone else?',
  ];
  const sponsorshipQuestion =
    'Is there a sponsorship fee required or is the nomination has a fee?';
  const faqQuestions = baseFaqQuestions.includes(sponsorshipQuestion)
    ? baseFaqQuestions
    : [...baseFaqQuestions, sponsorshipQuestion];

  const faqAnswers: Record<string, string> = {
    'Who can be nominated?':
      'Filipino individuals, professionals, community leaders, entrepreneurs, creatives, educators, and Filipino-led organizations whose work demonstrates measurable merit, integrity, and lasting societal impact.',
    'How does the nomination process work?':
      'Create a PEMA account and complete the official Nomination Form with your complete profile, profession, and optional CV/PDS or supporting proof. Every dossier undergoes formal evaluation by the PEMA panel; submitting a nomination does not automatically guarantee an award.',
    'When will fees be confirmed?':
      'Official awardee package rates, inclusions, and payment schedules are finalized and published by the PEMA Organizing Committee. Prospective nominees will be formally notified through their registered email and PEMA account portal once qualified.',
    'Can organizations nominate someone else?':
      'Yes. Corporations, civic groups, academic institutions, and colleagues may submit a nomination on behalf of an accomplished individual, provided accurate contact information and supporting accomplishments are included.',
    [sponsorshipQuestion]:
      'Should the nominee qualify and wish to participate in the awarding ceremony, the applicable participation package and inclusions will be provided for consideration.',
  };

  return {
    sourceUrl: LIVE_SITE_URL,
    lastSyncedAt: new Date(cache.fetchedAt).toISOString(),
    liveSyncOk: cache.liveSyncOk,
    syncStatusMessage: cache.syncStatusMessage,
    hero: {
      eyebrow: 'THE STANDARD OF FILIPINO EXCELLENCE',
      headlinePrefix: 'Where distinction',
      headlineEmphasis: 'takes its place.',
      subtitle: 'PEMA honors the people, organizations, and ideas moving the Philippines forward.',
    },
    about: {
      eyebrow: aboutArr[0] || 'About PEMA',
      title: aboutArr[1] || 'A standard worth reaching for.',
      paragraphs: aboutArr.slice(2),
    },
    services: {
      eyebrow: servicesArr[0] || 'Our services',
      title: servicesArr[1] || 'More than an award. A platform.',
      paragraphs: servicesArr.slice(2),
      items: [
        {
          number: '01',
          title: 'Nomination support',
          description: 'Clear guidance for presenting the work behind your impact.',
        },
        {
          number: '02',
          title: 'Visibility & storytelling',
          description: 'Thoughtful profiles that help achievements travel further.',
        },
        {
          number: '03',
          title: 'Recognition events',
          description: 'Distinctive moments that bring the PEMA community together.',
        },
      ],
    },
    pricing: {
      eyebrow: pricingArr[0] || 'Pricing',
      title: pricingArr[1] || 'Your achievement, thoughtfully presented.',
      paragraphs: pricingArr.slice(2, 3),
      confirmChecklist:
        pricingArr[3] || 'Confirm award fee · Confirm inclusions · Confirm payment deadline',
    },
    gallery: {
      eyebrow: 'Gallery',
      title: 'Moments with meaning.',
      subtitle: 'A glimpse of the atmosphere we’re building for Filipino excellence.',
    },
    faq: {
      eyebrow: 'Frequently asked',
      titlePrefix: 'Good questions.',
      titleEmphasis: 'Clear answers.',
      items: faqQuestions.map((q, idx) => ({
        number: String(idx + 1).padStart(2, '0'),
        question: q,
        answer:
          faqAnswers[q] ||
          'Please reach out to the PEMA Secretariat at 0924-173-7587 or pem.awards2027@gmail.com for official clarification.',
      })),
    },
    contact: {
      eyebrow: 'Contact PEMA',
      titlePrefix: 'Let’s talk',
      titleEmphasis: 'excellence.',
      subtitle:
        'Questions about nominations, partnerships, or the program? We’d love to hear from you.',
      responseNote: `Secretariat Desk · ${db.settings.contactNumber} · ${db.settings.contactEmail}`,
    },
    settings: db.settings,
    awardees: db.awardees,
    supportAvailable: db.supportAvailable,
  };
}

async function generateBusySupportAiReply(params: {
  liveContent: LiveWebsiteContent;
  thread: ChatThread;
  latestCustomerMessage: string;
}): Promise<{ text: string } | { error: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      error:
        'Automated AI support requires GEMINI_API_KEY in Settings > Secrets. Your ticket remains queued for human PEMA support.',
    };
  }
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    const systemInstruction = [
      'You are the PEMA Automated Support Assistant replying ONLY because human support is currently busy or away.',
      'Strictly base every answer ONLY on the verified Philippine Excellency and Merit Awards (PEMA) webapp details provided below.',
      'Never invent unconfirmed pricing amounts, ceremony dates, venue street addresses, registration numbers, or award decisions.',
      'Never mention or reveal internal administrator names.',
      'Keep replies concise, polite, and practical (under 140 words), and remind the user their Ticket No. remains queued for human review if needed.',
      '',
      `Organization: Philippine Excellency and Merit Awards (PEMA)`,
      `Contact Number: ${params.liveContent.settings.contactNumber}`,
      `Contact Email: ${params.liveContent.settings.contactEmail}`,
      `Office / Venue Note: ${params.liveContent.settings.officeLocation}`,
      `Ceremony Schedule Note: ${params.liveContent.settings.ceremonySchedule}`,
      `Nomination Rules: Requires a PEMA Member Account. Required form fields: Complete name, Contact information (Phone & Email), Current Age, Complete Address, Current Work/Profession, and CV/PDS (or to follow once qualified), plus optional Major Projects & Supporting Documents. IMPORTANT NOTE: Nomination does not automatically guarantee an award.`,
      `About PEMA: ${params.liveContent.about.title} — ${params.liveContent.about.paragraphs.join(' ')}`,
      `Services: ${params.liveContent.services.items.map((i) => `${i.title}: ${i.description}`).join(' | ')}`,
      `Pricing: ${params.liveContent.pricing.paragraphs.join(' ')} (${params.liveContent.pricing.confirmChecklist})`,
      `Sponsorship / Nomination Fee FAQ: Should the nominee qualify and wish to participate in the awarding ceremony, the applicable participation package and inclusions will be provided for consideration.`,
      `Evaluation Criteria (100%): ${NOMINATION_EVALUATION_CRITERIA.map((c) => `${c.number}. ${c.title} (${c.weightPercent}%)`).join('; ')}`,
      `Nomination Category Clusters: ${NOMINATION_CATEGORY_CLUSTERS.map((c) => c.clusterTitle).join('; ')}`,
      `FAQ: ${params.liveContent.faq.items.map((f) => `${f.question} -> ${f.answer}`).join(' | ')}`,
      `Headline Bulletin: ${params.liveContent.settings.headlineTemplate.headline} — ${params.liveContent.settings.headlineTemplate.subheadline}`,
      `Highlight of the Month: ${params.liveContent.settings.highlightOfTheMonth.title} (${params.liveContent.settings.highlightOfTheMonth.honoreeName}) — ${params.liveContent.settings.highlightOfTheMonth.summary}`,
    ].join('\n');

    const recentHistory = params.thread.messages
      .slice(-6)
      .map((m) => `${m.senderDisplayName} (${m.sentAt}): ${m.text}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Ticket ${params.thread.ticketNumber} for ${params.thread.customerName}\nConversation context:\n${recentHistory}\n\nLatest customer message: ${params.latestCustomerMessage}`,
      config: { systemInstruction },
    });
    const text = (response.text ?? '').trim();
    if (!text) {
      return {
        error: `Automated AI assistant returned no response. Your ticket ${params.thread.ticketNumber} remains queued for human support.`,
      };
    }
    return { text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI service error';
    return {
      error: `Automated AI assistant encountered an error (${msg}). Your ticket ${params.thread.ticketNumber} remains queued for human support.`,
    };
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function toPublicUserAccount(user: StoredUser, db: PemaDatabase): UserAccount {
  const passkeyCount = db.passkeys.filter((p) => p.userId === user.id).length;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    createdAt: user.createdAt,
    hasPasskey: passkeyCount > 0,
    passkeyCount,
  };
}

function getRequestUser(req: express.Request): UserAccount | null {
  const db = loadDb();
  const cookies = parseCookies(req.headers.cookie);
  const headerToken = req.headers['x-pema-token'] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const token = headerToken || bearer || cookies.pema_user_token;
  if (!token) return null;

  const session = db.sessions.find((s) => s.token === token && s.userId);
  if (!session) return null;
  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return toPublicUserAccount(user, db);
}

const WEBAUTHN_CHALLENGE_TTL_MS = 3 * 60 * 1000;
const webAuthnChallenges = new Map<
  string,
  { challenge: string; userId?: string; rpID: string; origin: string; expiresAt: number }
>();

function storeWebAuthnChallenge(
  key: string,
  entry: { challenge: string; userId?: string; rpID: string; origin: string },
) {
  const now = Date.now();
  for (const [k, v] of webAuthnChallenges.entries()) {
    if (v.expiresAt < now) webAuthnChallenges.delete(k);
  }
  webAuthnChallenges.set(key, {
    ...entry,
    expiresAt: now + WEBAUTHN_CHALLENGE_TTL_MS,
  });
}

function consumeWebAuthnChallenge(key: string) {
  const item = webAuthnChallenges.get(key);
  webAuthnChallenges.delete(key);
  if (!item || item.expiresAt < Date.now()) {
    return null;
  }
  return item;
}

const REMEMBER_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setMemberSessionCookie(res: express.Response, token: string, rememberDevice: boolean) {
  res.cookie('pema_user_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    ...(rememberDevice ? { maxAge: REMEMBER_COOKIE_MAX_AGE_MS } : {}),
  });
}

function getAdminSession(req: express.Request): {
  isAdmin: boolean;
  adminName: string | null;
  department: AdminDepartmentRole | null;
} {
  const db = loadDb();
  const cookies = parseCookies(req.headers.cookie);
  const headerToken = req.headers['x-pema-admin-token'] as string | undefined;
  const token = headerToken || cookies.pema_admin_token;
  if (!token) return { isAdmin: false, adminName: null, department: null };
  const session = db.sessions.find((s) => s.token === token && s.isAdmin === true);
  if (!session) return { isAdmin: false, adminName: null, department: null };

  const dept = session.department ?? 'executive';
  if (dept === 'executive') {
    const validName = session.adminName ? normalizeAuthorizedAdminName(session.adminName) : null;
    if (!validName) return { isAdmin: false, adminName: null, department: null };
    return { isAdmin: true, adminName: validName, department: 'executive' };
  }

  if (isValidDepartmentAccessRole(dept)) {
    const displayName =
      (session.adminName && session.adminName.trim()) ||
      DEPARTMENT_ROLE_CATALOG[dept].shortLabel;
    return { isAdmin: true, adminName: displayName, department: dept };
  }

  return { isAdmin: false, adminName: null, department: null };
}

function isAdminAuthenticated(req: express.Request): boolean {
  return getAdminSession(req).isAdmin;
}

const sseClients = new Set<express.Response>();

function broadcastEvent(type: string, payload?: unknown): void {
  const frame = `data: ${JSON.stringify({ type, payload: payload ?? null, ts: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '200mb' }));
  app.use('/api', (req, res, next) => {
    if (req.path !== '/events') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Real-time Server-Sent Events stream for instant updates across portal screens
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);

    sseClients.add(res);
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Serve uploaded receipts & documents safely
  app.get('/api/uploads/:storedName', (req, res) => {
    const safeName = path.basename(req.params.storedName || '');
    const filePath = path.join(UPLOADS_DIR, safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found.' });
      return;
    }
    res.sendFile(filePath);
  });

  // Real-time live content endpoint pulled from reference site + confirmed settings
  app.get('/api/live-content', async (req, res) => {
    const force = req.query.refresh === '1';
    const cache = await fetchLiveWebsiteSnippet(force);
    res.json(buildLiveContent(cache));
  });

  // User Auth
  app.get('/api/auth/me', (req, res) => {
    const user = getRequestUser(req);
    res.json({ user });
  });

  app.post('/api/auth/register', (req, res) => {
    const fullName = String(req.body?.fullName ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phoneNumber = String(req.body?.phoneNumber ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (fullName.length < 2) {
      res.status(400).json({ error: 'Please enter your complete full name.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    const db = loadDb();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      return;
    }

    const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const newUser = {
      id: userId,
      fullName,
      email,
      phoneNumber,
      passwordHash: hashPassword(password),
      createdAt: now,
    };
    db.users.push(newUser);

    // Link any previously submitted nominations/payments with same email
    for (const n of db.nominations) {
      if (!n.userId && n.emailAddress.toLowerCase() === email) {
        n.userId = userId;
      }
    }
    for (const p of db.payments) {
      if (!p.userId && p.payerEmail.toLowerCase() === email) {
        p.userId = userId;
      }
    }

    const rememberDevice = req.body?.rememberDevice !== false;
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions.push({ token, userId, createdAt: now });
    saveDb(db);

    setMemberSessionCookie(res, token, rememberDevice);
    res.status(201).json({
      token,
      user: toPublicUserAccount(newUser, db),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const rememberDevice = req.body?.rememberDevice !== false;
    const db = loadDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email address or password.' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
    saveDb(db);

    setMemberSessionCookie(res, token, rememberDevice);
    res.json({
      token,
      user: toPublicUserAccount(user, db),
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = (req.headers['x-pema-token'] as string) || cookies.pema_user_token;
    if (token) {
      const db = loadDb();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      saveDb(db);
    }
    res.clearCookie('pema_user_token', { path: '/' });
    res.json({ ok: true });
  });

  // Biometric / Fingerprint Passkey (WebAuthn) Authentication & Device Management
  app.post('/api/auth/webauthn/status', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.json({ hasPasskey: false, passkeyCount: 0, deviceLabel: null });
      return;
    }
    const db = loadDb();
    const targetUser = db.users.find((u) => u.email.toLowerCase() === email);
    if (!targetUser) {
      res.json({ hasPasskey: false, passkeyCount: 0, deviceLabel: null });
      return;
    }
    const userPasskeys = db.passkeys.filter((p) => p.userId === targetUser.id);
    const latest = userPasskeys[0] ?? null;
    res.json({
      hasPasskey: userPasskeys.length > 0,
      passkeyCount: userPasskeys.length,
      deviceLabel: latest ? latest.deviceLabel : null,
    });
  });

  app.get('/api/auth/passkeys', (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const db = loadDb();
    const devices: PublicPasskeyDevice[] = db.passkeys
      .filter((p) => p.userId === user.id)
      .map(({ id, deviceLabel, deviceType, backedUp, createdAt, lastUsedAt }) => ({
        id,
        deviceLabel,
        deviceType,
        backedUp,
        createdAt,
        lastUsedAt,
      }));
    res.json({ devices });
  });

  app.delete('/api/auth/passkeys/:id', (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const db = loadDb();
    const before = db.passkeys.length;
    db.passkeys = db.passkeys.filter((p) => !(p.id === req.params.id && p.userId === user.id));
    if (db.passkeys.length === before) {
      res.status(404).json({ error: 'Biometric device record not found.' });
      return;
    }
    saveDb(db);
    res.json({ ok: true, passkeyCount: db.passkeys.filter((p) => p.userId === user.id).length });
  });

  app.post('/api/auth/webauthn/register/options', async (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please sign in to register fingerprint/biometrics.' });
      return;
    }
    const db = loadDb();
    const { rpID, origin } = resolveWebAuthnRpAndOrigin({
      originHeader: req.headers.origin,
      forwardedProto: req.headers['x-forwarded-proto'],
      forwardedHost: req.headers['x-forwarded-host'],
      hostHeader: req.headers.host,
      protocol: req.protocol,
    });

    const userPasskeys = db.passkeys.filter((p) => p.userId === user.id);
    const options = await generateRegistrationOptions({
      rpName: 'Philippine Excellency & Merit Awards (PEMA)',
      rpID,
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.fullName,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    storeWebAuthnChallenge(`reg:${user.id}`, {
      challenge: options.challenge,
      userId: user.id,
      rpID,
      origin,
    });
    res.json({ options, rpID });
  });

  app.post('/api/auth/webauthn/register/verify', async (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const expected = consumeWebAuthnChallenge(`reg:${user.id}`);
    if (!expected) {
      res.status(400).json({ error: 'Biometric registration session expired. Please try again.' });
      return;
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: req.body?.response,
        expectedChallenge: expected.challenge,
        expectedOrigin: expected.origin,
        expectedRPID: expected.rpID,
        requireUserVerification: true,
      });

      if (!verification.verified || !verification.registrationInfo) {
        res.status(400).json({ error: 'Could not verify your device fingerprint/biometric credential.' });
        return;
      }

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const db = loadDb();
      const now = new Date().toISOString();
      const customLabel =
        typeof req.body?.deviceLabel === 'string' && req.body.deviceLabel.trim()
          ? req.body.deviceLabel.trim().slice(0, 60)
          : parsePasskeyDeviceLabel(req.headers['user-agent']);

      const existingIdx = db.passkeys.findIndex((p) => p.credentialId === credential.id);
      const record: UserPasskeyCredential = {
        id: existingIdx >= 0 ? db.passkeys[existingIdx].id : `pk-${crypto.randomUUID().slice(0, 8)}`,
        userId: user.id,
        credentialId: credential.id,
        publicKeyB64: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        transports: credential.transports ? [...credential.transports] : ['internal'],
        deviceLabel: customLabel,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        createdAt: existingIdx >= 0 ? db.passkeys[existingIdx].createdAt : now,
        lastUsedAt: null,
      };

      if (existingIdx >= 0) {
        db.passkeys[existingIdx] = record;
      } else {
        db.passkeys.unshift(record);
      }
      saveDb(db);

      const storedUser = db.users.find((u) => u.id === user.id);
      res.status(201).json({
        verified: true,
        user: storedUser ? toPublicUserAccount(storedUser, db) : user,
        device: {
          id: record.id,
          deviceLabel: record.deviceLabel,
          deviceType: record.deviceType,
          backedUp: record.backedUp,
          createdAt: record.createdAt,
          lastUsedAt: record.lastUsedAt,
        } satisfies PublicPasskeyDevice,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Fingerprint registration verification failed.',
      });
    }
  });

  app.post('/api/auth/webauthn/login/options', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const db = loadDb();
    const { rpID, origin } = resolveWebAuthnRpAndOrigin({
      originHeader: req.headers.origin,
      forwardedProto: req.headers['x-forwarded-proto'],
      forwardedHost: req.headers['x-forwarded-host'],
      hostHeader: req.headers.host,
      protocol: req.protocol,
    });

    let allowCredentials: Array<{ id: string; transports?: AuthenticatorTransport[] }> | undefined;
    if (email) {
      const targetUser = db.users.find((u) => u.email.toLowerCase() === email);
      if (!targetUser) {
        res.status(404).json({ error: 'No PEMA account found with that email address.' });
        return;
      }
      const userPasskeys = db.passkeys.filter((p) => p.userId === targetUser.id);
      if (userPasskeys.length === 0) {
        res.status(400).json({
          error:
            'Fingerprint / Biometric login is not yet enabled on that account. Sign in with your password once and tap "Yes, Enable Fingerprint".',
        });
        return;
      }
      allowCredentials = userPasskeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports as AuthenticatorTransport[],
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'required',
    });

    const challengeId = `auth-${crypto.randomUUID().slice(0, 12)}`;
    storeWebAuthnChallenge(challengeId, {
      challenge: options.challenge,
      rpID,
      origin,
    });
    res.json({ challengeId, options });
  });

  app.post('/api/auth/webauthn/login/verify', async (req, res) => {
    const challengeId = String(req.body?.challengeId ?? '').trim();
    const response = req.body?.response;
    const rememberDevice = req.body?.rememberDevice !== false;

    const expected = consumeWebAuthnChallenge(challengeId);
    if (!expected) {
      res.status(400).json({ error: 'Fingerprint login challenge expired. Please tap Fingerprint Sign In again.' });
      return;
    }
    if (!response?.id) {
      res.status(400).json({ error: 'Missing biometric credential response.' });
      return;
    }

    const db = loadDb();
    const passkey = db.passkeys.find((p) => p.credentialId === response.id);
    if (!passkey) {
      res.status(401).json({
        error: 'This device fingerprint is not linked to any PEMA account on this portal. Sign in with password first and enable Fingerprint.',
      });
      return;
    }
    const user = db.users.find((u) => u.id === passkey.userId);
    if (!user) {
      res.status(401).json({ error: 'Associated PEMA member account no longer exists.' });
      return;
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: expected.challenge,
        expectedOrigin: expected.origin,
        expectedRPID: expected.rpID,
        requireUserVerification: true,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKeyB64, 'base64')),
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransport[],
        },
      });

      if (!verification.verified) {
        res.status(401).json({ error: 'Biometric verification failed.' });
        return;
      }

      const now = new Date().toISOString();
      passkey.counter = verification.authenticationInfo.newCounter;
      passkey.lastUsedAt = now;

      const token = crypto.randomBytes(24).toString('hex');
      db.sessions.push({ token, userId: user.id, createdAt: now });
      saveDb(db);

      setMemberSessionCookie(res, token, rememberDevice);
      res.json({
        token,
        user: toPublicUserAccount(user, db),
        deviceLabel: passkey.deviceLabel,
      });
    } catch (err) {
      res.status(401).json({
        error: err instanceof Error ? err.message : 'Fingerprint authentication could not be verified.',
      });
    }
  });

  // Nominations (requires signed-in PEMA Member Account)
  app.post('/api/nominations', (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({
        error: 'Please create or sign in to your PEMA Member Account before submitting a nomination.',
      });
      return;
    }
    const body = req.body ?? {};
    const validation = validateNominationForm({
      completeName: String(body.completeName ?? ''),
      phoneNumber: String(body.phoneNumber ?? ''),
      emailAddress: String(body.emailAddress ?? ''),
      currentAge: body.currentAge ?? '',
      completeAddress: String(body.completeAddress ?? ''),
      currentWorkProfession: String(body.currentWorkProfession ?? ''),
      cvWillFollow: Boolean(body.cvWillFollow),
      majorProjects: String(body.majorProjects ?? ''),
    });

    if (!validation.valid || validation.parsedAge === null) {
      res.status(400).json({ error: 'Please complete all required nomination fields.', fieldErrors: validation.errors });
      return;
    }

    const db = loadDb();
    db.lastSequence += 1;
    const seq = db.lastSequence;
    const now = new Date().toISOString();
    const nomId = `nom-${crypto.randomUUID().slice(0, 8)}`;

    let cvFile = null;
    if (body.cvUpload?.dataUrl && body.cvUpload?.fileName) {
      try {
        cvFile = saveBase64Upload({
          fileName: body.cvUpload.fileName,
          dataUrl: body.cvUpload.dataUrl,
          prefix: `cv-${nomId}`,
        });
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid CV/PDS file.' });
        return;
      }
    }

    const supportingDocs = [];
    if (Array.isArray(body.supportingUploads)) {
      for (const item of body.supportingUploads.slice(0, 5)) {
        if (item?.dataUrl && item?.fileName) {
          try {
            supportingDocs.push(
              saveBase64Upload({
                fileName: item.fileName,
                dataUrl: item.dataUrl,
                prefix: `doc-${nomId}`,
              }),
            );
          } catch (e) {
            res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid supporting document.' });
            return;
          }
        }
      }
    }

    const matchedUser =
      user ||
      db.users.find((u) => u.email.toLowerCase() === String(body.emailAddress).trim().toLowerCase()) ||
      null;

    const nomination: NominationRecord = {
      id: nomId,
      referenceCode: generateReferenceCode('PEMA', seq, 2027),
      userId: matchedUser ? matchedUser.id : null,
      completeName: String(body.completeName).trim(),
      phoneNumber: String(body.phoneNumber).trim(),
      emailAddress: String(body.emailAddress).trim(),
      currentAge: validation.parsedAge,
      completeAddress: String(body.completeAddress).trim(),
      currentWorkProfession: String(body.currentWorkProfession).trim(),
      cvWillFollow: cvFile ? false : Boolean(body.cvWillFollow ?? true),
      cvFile,
      majorProjects: String(body.majorProjects ?? '').trim(),
      supportingDocs,
      status: 'Pending',
      committeeNotes: 'Received and queued as Pending evaluation by the PEMA Screening Committee.',
      createdAt: now,
      updatedAt: now,
    };

    const payment: PaymentRecord = {
      id: `pay-${crypto.randomUUID().slice(0, 8)}`,
      receiptReference: generateReferenceCode('OR', seq, 2027),
      nominationId: nomId,
      userId: matchedUser ? matchedUser.id : null,
      payerName: nomination.completeName,
      payerEmail: nomination.emailAddress,
      payerPhone: nomination.phoneNumber,
      description: `Nomination Dossier ${nomination.referenceCode} — Fee Subject to Committee Confirmation`,
      amountDue: 0,
      amountPaid: 0,
      currency: 'PHP',
      paymentMethod: 'Pending Assessment',
      paymentDate: '',
      status: 'Pending Confirmation',
      userProofFile: null,
      officialReceiptFile: null,
      adminRemarks: 'Awaiting evaluation review & committee fee confirmation.',
      createdAt: now,
      updatedAt: now,
    };

    db.nominations.unshift(nomination);
    db.payments.unshift(payment);
    saveDb(db);
    broadcastEvent('nomination_created', { id: nomination.id, referenceCode: nomination.referenceCode });

    res.status(201).json({ nomination, payment });
  });

  app.get('/api/my/dashboard', (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please sign in to access your PEMA account.' });
      return;
    }
    const db = loadDb();
    const nominations = db.nominations.filter(
      (n) => n.userId === user.id || n.emailAddress.toLowerCase() === user.email.toLowerCase(),
    );
    const payments = db.payments.filter(
      (p) => p.userId === user.id || p.payerEmail.toLowerCase() === user.email.toLowerCase(),
    );
    res.json({ user, nominations, payments });
  });

  app.post('/api/my/nominations/:id/cv', (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const db = loadDb();
    const nom = db.nominations.find(
      (n) => n.id === req.params.id && (n.userId === user.id || n.emailAddress.toLowerCase() === user.email.toLowerCase()),
    );
    if (!nom) {
      res.status(404).json({ error: 'Nomination record not found.' });
      return;
    }
    const { fileName, dataUrl } = req.body ?? {};
    if (!fileName || !dataUrl) {
      res.status(400).json({ error: 'Please select a CV or PDS file to upload.' });
      return;
    }
    try {
      nom.cvFile = saveBase64Upload({ fileName, dataUrl, prefix: `cv-${nom.id}` });
      nom.cvWillFollow = false;
      nom.updatedAt = new Date().toISOString();
      saveDb(db);
      broadcastEvent('nomination_updated', { id: nom.id });
      res.json({ nomination: nom });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Upload failed.' });
    }
  });

  app.post('/api/my/payments/:id/proof', (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const db = loadDb();
    const payment = db.payments.find(
      (p) => p.id === req.params.id && (p.userId === user.id || p.payerEmail.toLowerCase() === user.email.toLowerCase()),
    );
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    const { fileName, dataUrl, paymentMethod } = req.body ?? {};
    if (!fileName || !dataUrl) {
      res.status(400).json({ error: 'Please upload an image or PDF proof of payment.' });
      return;
    }
    try {
      payment.userProofFile = saveBase64Upload({ fileName, dataUrl, prefix: `proof-${payment.id}` });
      if (paymentMethod) payment.paymentMethod = String(paymentMethod).trim();
      payment.status = 'Receipt Uploaded';
      payment.paymentDate = payment.paymentDate || new Date().toISOString().slice(0, 10);
      payment.updatedAt = new Date().toISOString();
      saveDb(db);
      broadcastEvent('payment_updated', { id: payment.id });
      res.json({ payment });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : 'Proof upload failed.' });
    }
  });

  // Contact inquiry submission
  app.post('/api/contact', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const subject = String(req.body?.subject ?? 'General PEMA Inquiry').trim();
    const message = String(req.body?.message ?? '').trim();

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 5) {
      res.status(400).json({ error: 'Please enter your name, a valid email address, and your message.' });
      return;
    }

    const db = loadDb();
    const inquiry: ContactInquiry = {
      id: `inq-${crypto.randomUUID().slice(0, 8)}`,
      name,
      email,
      phone,
      subject,
      message,
      createdAt: new Date().toISOString(),
      status: 'New',
    };
    db.inquiries.unshift(inquiry);
    saveDb(db);
    broadcastEvent('inquiry_created', { id: inquiry.id });
    res.status(201).json({ inquiry });
  });

  // PEMA 1-to-1 Conversational Chat Support (requires PEMA account; 1 thread per user account)
  app.get('/api/chat/my-thread', (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please create or sign in to a PEMA account to use Chat Support.' });
      return;
    }
    const db = loadDb();
    const thread = db.chatThreads.find((t) => t.userId === user.id) ?? null;
    const previewTicketNumber =
      thread?.ticketNumber || generateReferenceCode('TKT', db.lastSequence + 1, 2027);
    res.json({
      thread,
      supportAvailable: db.supportAvailable,
      previewTicketNumber,
    });
  });

  app.post('/api/chat/start', async (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Please create or sign in to a PEMA account to start Chat Support.' });
      return;
    }

    const db = loadDb();
    const existing = db.chatThreads.find((t) => t.userId === user.id);
    if (existing) {
      res.json({ thread: existing });
      return;
    }

    const body = req.body ?? {};
    const customerName = String(body.customerName ?? user.fullName).trim();
    const contactNumber = String(body.contactNumber ?? '').trim();
    const inquiryReason = String(body.inquiryReason ?? '').trim();
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];

    const validation = validateChatIntake({
      customerName,
      contactNumber,
      inquiryReason,
      attachmentCount: rawAttachments.length,
    });

    if (!validation.valid) {
      res.status(400).json({
        error: 'Please complete all required Chat Support intake fields.',
        fieldErrors: validation.errors,
      });
      return;
    }

    const savedAttachments: UploadedFileRef[] = [];
    for (const item of rawAttachments.slice(0, MAX_CHAT_ATTACHMENTS)) {
      if (item?.dataUrl && item?.fileName) {
        try {
          savedAttachments.push(
            saveBase64Upload({
              fileName: item.fileName,
              dataUrl: item.dataUrl,
              prefix: `chat-${user.id}`,
            }),
          );
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid attachment.' });
          return;
        }
      }
    }

    db.lastSequence += 1;
    const now = new Date().toISOString();
    const ticketNumber = generateReferenceCode('TKT', db.lastSequence, 2027);

    const firstMsg: ChatMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      senderRole: 'customer',
      senderDisplayName: customerName,
      text: inquiryReason,
      attachments: savedAttachments,
      sentAt: now,
    };

    const thread: ChatThread = {
      id: `cht-${crypto.randomUUID().slice(0, 8)}`,
      ticketNumber,
      userId: user.id,
      userAccountName: user.fullName,
      userEmail: user.email,
      customerName,
      contactNumber,
      inquiryReason,
      status: db.supportAvailable ? 'Active' : 'Queued',
      messages: [firstMsg],
      createdAt: now,
      updatedAt: now,
    };

    let aiNotice: string | null = null;
    if (!db.supportAvailable) {
      const cache = await fetchLiveWebsiteSnippet(false);
      const liveContent = buildLiveContent(cache);
      const aiReply = await generateBusySupportAiReply({
        liveContent,
        thread,
        latestCustomerMessage: inquiryReason,
      });
      if ('text' in aiReply) {
        thread.messages.push({
          id: `msg-${crypto.randomUUID().slice(0, 8)}`,
          senderRole: 'ai',
          senderDisplayName: 'PEMA AI Support Assistant',
          text: aiReply.text,
          attachments: [],
          sentAt: new Date().toISOString(),
        });
      } else {
        aiNotice = aiReply.error;
      }
    }

    db.chatThreads.unshift(thread);
    saveDb(db);
    broadcastEvent('chat_updated', { threadId: thread.id, ticketNumber: thread.ticketNumber });
    res.status(201).json({ thread, aiNotice });
  });

  app.post('/api/chat/messages', async (req, res) => {
    const user = getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required for PEMA Chat Support.' });
      return;
    }

    const db = loadDb();
    const thread = db.chatThreads.find((t) => t.userId === user.id);
    if (!thread) {
      res.status(404).json({ error: 'Please complete the pre-chat ticket form first.' });
      return;
    }

    const body = req.body ?? {};
    const text = String(body.text ?? '').trim();
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!text && rawAttachments.length === 0) {
      res.status(400).json({ error: 'Please type a message or attach a file/photo.' });
      return;
    }
    if (rawAttachments.length > MAX_CHAT_ATTACHMENTS) {
      res.status(400).json({ error: `Maximum of ${MAX_CHAT_ATTACHMENTS} attachments per message.` });
      return;
    }

    const savedAttachments: UploadedFileRef[] = [];
    for (const item of rawAttachments.slice(0, MAX_CHAT_ATTACHMENTS)) {
      if (item?.dataUrl && item?.fileName) {
        try {
          savedAttachments.push(
            saveBase64Upload({
              fileName: item.fileName,
              dataUrl: item.dataUrl,
              prefix: `chat-${user.id}`,
            }),
          );
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid attachment.' });
          return;
        }
      }
    }

    const now = new Date().toISOString();
    thread.messages.push({
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      senderRole: 'customer',
      senderDisplayName: thread.customerName,
      text: text || '(Sent file/photo attachment)',
      attachments: savedAttachments,
      sentAt: now,
    });
    thread.updatedAt = now;

    let aiNotice: string | null = null;
    if (!db.supportAvailable && text) {
      const cache = await fetchLiveWebsiteSnippet(false);
      const liveContent = buildLiveContent(cache);
      const aiReply = await generateBusySupportAiReply({
        liveContent,
        thread,
        latestCustomerMessage: text,
      });
      if ('text' in aiReply) {
        thread.messages.push({
          id: `msg-${crypto.randomUUID().slice(0, 8)}`,
          senderRole: 'ai',
          senderDisplayName: 'PEMA AI Support Assistant',
          text: aiReply.text,
          attachments: [],
          sentAt: new Date().toISOString(),
        });
        thread.updatedAt = new Date().toISOString();
      } else {
        aiNotice = aiReply.error;
      }
    }

    saveDb(db);
    broadcastEvent('chat_updated', { threadId: thread.id, ticketNumber: thread.ticketNumber });
    res.json({ thread, aiNotice });
  });

  // Secured Admin Authentication & Separated Departmental Dashboard Routes
  app.get('/api/admin/session', (req, res) => {
    const session = getAdminSession(req);
    res.json({
      isAdmin: session.isAdmin,
      adminName: session.isAdmin ? session.adminName : null,
      department: session.isAdmin ? session.department : null,
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const accessMode = String(req.body?.accessMode ?? 'executive').trim();
    const password = String(req.body?.password ?? '');
    const db = loadDb();

    if (accessMode === 'department') {
      const deptRaw = String(req.body?.department ?? '').trim();
      const staffName = String(req.body?.staffName ?? '').trim();
      if (!isValidDepartmentAccessRole(deptRaw)) {
        res.status(400).json({ error: 'Select a valid PEMA department or evaluator role.' });
        return;
      }
      const expectedPasscode = db.departmentPasscodes[deptRaw];
      if (!expectedPasscode || password !== expectedPasscode) {
        res.status(401).json({
          error: 'Access denied. Invalid department access passcode.',
        });
        return;
      }
      const displayName = staffName.length >= 2 ? staffName : DEPARTMENT_ROLE_CATALOG[deptRaw].shortLabel;
      const token = crypto.randomBytes(24).toString('hex');
      db.sessions.push({
        token,
        isAdmin: true,
        adminName: displayName,
        department: deptRaw,
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
      res.cookie('pema_admin_token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
      res.json({ isAdmin: true, adminName: displayName, department: deptRaw, token });
      return;
    }

    const authorizedName = normalizeAuthorizedAdminName(String(req.body?.adminName ?? ''));
    if (!authorizedName || password !== ADMIN_PASSWORD) {
      res.status(401).json({
        error: 'Access denied. Valid authorized administrator name and password are required.',
      });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions.push({
      token,
      isAdmin: true,
      adminName: authorizedName,
      department: 'executive',
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    res.cookie('pema_admin_token', token, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.json({ isAdmin: true, adminName: authorizedName, department: 'executive', token });
  });

  app.post('/api/admin/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = (req.headers['x-pema-admin-token'] as string) || cookies.pema_admin_token;
    if (token) {
      const db = loadDb();
      db.sessions = db.sessions.filter((s) => s.token !== token);
      saveDb(db);
    }
    res.clearCookie('pema_admin_token', { path: '/' });
    res.json({ ok: true });
  });

  function buildAdminOverviewResponse(
    db: ReturnType<typeof loadDb>,
    role: AdminDepartmentRole = 'executive',
  ) {
    const isExecutive = role === 'executive';
    const isBoardOrEval =
      role === 'executive' ||
      role === 'committee' ||
      EVALUATOR_SLOTS.includes(role as EvaluatorSlot);
    const isFundingOrFinance = role === 'executive' || role === 'funding' || role === 'finance';

    const users = isExecutive ? db.users.map(({ passwordHash: _ignored, ...safe }) => safe) : [];
    return {
      department: role,
      users,
      nominations: isBoardOrEval
        ? db.nominations
        : isFundingOrFinance
          ? db.nominations.map((n) => ({
              ...n,
              cvFile: null,
              supportingDocs: [],
              majorProjects: '',
            }))
          : [],
      payments: isFundingOrFinance ? db.payments : [],
      inquiries: isExecutive ? db.inquiries : [],
      emailNotifications: role === 'executive' || role === 'committee' ? db.emailNotifications : [],
      settings: db.settings,
      awardees: isExecutive ? db.awardees : [],
      legitimacyCredentials: isExecutive ? db.legitimacyCredentials : [],
      projectFunding: isFundingOrFinance ? db.projectFunding : [],
      nominationEvaluations: isBoardOrEval ? db.nominationEvaluations : [],
      departmentPasscodes: isExecutive ? db.departmentPasscodes : undefined,
      chatThreads: isExecutive ? db.chatThreads : [],
      supportAvailable: db.supportAvailable,
      revisions: isExecutive
        ? db.adminRevisions.map(({ id, label, adminName, createdAt }) => ({
            id,
            label,
            adminName,
            createdAt,
          }))
        : [],
    };
  }

  app.get('/api/admin/overview', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.department) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const db = loadDb();
    res.json(buildAdminOverviewResponse(db, admin.department));
  });

  // Revert / Undo last admin mutation (Executive Admin only)
  app.post('/api/admin/undo', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.department) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (admin.department !== 'executive') {
      res.status(403).json({ error: 'Global Revert / Undo is reserved for Executive Administrators.' });
      return;
    }
    const db = loadDb();
    const reverted = popAdminRevision(db);
    if (!reverted) {
      res.status(400).json({ error: 'No earlier change available to revert or undo.' });
      return;
    }
    saveDb(db);
    broadcastEvent('admin_reverted', { label: reverted.label });
    broadcastEvent('settings_updated', { updatedAt: new Date().toISOString() });
    res.json({
      revertedRevision: {
        id: reverted.id,
        label: reverted.label,
        adminName: reverted.adminName,
        createdAt: reverted.createdAt,
      },
      overview: buildAdminOverviewResponse(db, admin.department),
    });
  });

  app.patch('/api/admin/nominations/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleDecideNomination(admin.department)) {
      res.status(403).json({
        error: 'Final nomination status decisions are restricted to the Committee on Board and Executive Administrators.',
      });
      return;
    }
    const db = loadDb();
    const nom = db.nominations.find((n) => n.id === req.params.id);
    if (!nom) {
      res.status(404).json({ error: 'Nomination not found.' });
      return;
    }
    pushAdminRevision(db, `Updated nomination ${nom.referenceCode}`, admin.adminName);

    const validStatuses: NominationStatus[] = [
      'Pending',
      'Approved',
      'Rejected',
      'Submitted',
      'Under Evaluation',
      'Qualified',
      'Awardee Confirmed',
      'Not Selected',
    ];
    const previousStatus = nom.status;
    if (req.body?.status && validStatuses.includes(req.body.status)) {
      nom.status = req.body.status;
    }
    if (typeof req.body?.committeeNotes === 'string') {
      nom.committeeNotes = req.body.committeeNotes.trim();
    }
    nom.updatedAt = new Date().toISOString();

    let simulatedEmail: SimulatedEmailNotification | null = null;
    if (
      (nom.status === 'Approved' || nom.status === 'Rejected') &&
      previousStatus !== nom.status
    ) {
      const emailDraft = buildNominationStatusEmail({
        recipientName: nom.completeName,
        referenceCode: nom.referenceCode,
        newStatus: nom.status,
        committeeNotes: nom.committeeNotes,
        contactNumber: db.settings.contactNumber,
        contactEmail: db.settings.contactEmail,
      });
      simulatedEmail = {
        id: `eml-${crypto.randomUUID().slice(0, 8)}`,
        nominationId: nom.id,
        referenceCode: nom.referenceCode,
        recipientName: nom.completeName,
        recipientEmail: nom.emailAddress,
        previousStatus,
        newStatus: nom.status,
        subject: emailDraft.subject,
        body: emailDraft.body,
        sentAt: new Date().toISOString(),
        deliveryStatus: 'Simulated & Delivered',
      };
      db.emailNotifications.unshift(simulatedEmail);
    }

    saveDb(db);
    broadcastEvent('nomination_updated', {
      id: nom.id,
      status: nom.status,
      simulatedEmailId: simulatedEmail?.id ?? null,
    });
    res.json({ nomination: nom, simulatedEmail });
  });

  app.delete('/api/admin/nominations/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleDecideNomination(admin.department)) {
      res.status(403).json({
        error: 'Deleting nominations is restricted to Executive Administrators and Committee on Board.',
      });
      return;
    }
    const db = loadDb();
    const target = db.nominations.find((n) => n.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Nomination not found.' });
      return;
    }
    pushAdminRevision(db, `Deleted nomination ${target.referenceCode}`, admin.adminName);
    db.nominations = db.nominations.filter((n) => n.id !== req.params.id);
    saveDb(db);
    broadcastEvent('nomination_updated', { deletedId: req.params.id });
    res.json({ ok: true });
  });

  // Admin-only endpoint to simulate/dispatch status email notifications (Pending -> Approved / Rejected)
  app.post('/api/admin/notifications/simulate', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleDecideNomination(admin.department)) {
      res.status(403).json({
        error: 'Status notification dispatch is restricted to Committee on Board and Executive Administrators.',
      });
      return;
    }
    const nominationId = String(req.body?.nominationId ?? '').trim();
    const newStatus = req.body?.newStatus as 'Approved' | 'Rejected' | undefined;
    const customNote = typeof req.body?.customNote === 'string' ? req.body.customNote.trim() : '';

    if (!nominationId || (newStatus !== 'Approved' && newStatus !== 'Rejected')) {
      res.status(400).json({ error: 'Select a nomination and target decision (Approved or Rejected).' });
      return;
    }

    const db = loadDb();
    const nom = db.nominations.find((n) => n.id === nominationId);
    if (!nom) {
      res.status(404).json({ error: 'Nomination record not found.' });
      return;
    }

    pushAdminRevision(db, `Simulated ${newStatus} email for ${nom.referenceCode}`, admin.adminName);

    const previousStatus = nom.status;
    nom.status = newStatus;
    if (customNote) {
      nom.committeeNotes = customNote;
    } else if (!nom.committeeNotes) {
      nom.committeeNotes =
        newStatus === 'Approved'
          ? 'Approved by the PEMA Screening Committee.'
          : 'Not selected following evaluation.';
    }
    nom.updatedAt = new Date().toISOString();

    const emailDraft = buildNominationStatusEmail({
      recipientName: nom.completeName,
      referenceCode: nom.referenceCode,
      newStatus,
      committeeNotes: nom.committeeNotes,
      contactNumber: db.settings.contactNumber,
      contactEmail: db.settings.contactEmail,
    });

    const simulatedEmail: SimulatedEmailNotification = {
      id: `eml-${crypto.randomUUID().slice(0, 8)}`,
      nominationId: nom.id,
      referenceCode: nom.referenceCode,
      recipientName: nom.completeName,
      recipientEmail: nom.emailAddress,
      previousStatus,
      newStatus,
      subject: emailDraft.subject,
      body: emailDraft.body,
      sentAt: new Date().toISOString(),
      deliveryStatus: 'Simulated & Delivered',
    };

    db.emailNotifications.unshift(simulatedEmail);
    saveDb(db);
    broadcastEvent('nomination_status_email', {
      id: simulatedEmail.id,
      nominationId: nom.id,
      newStatus,
    });
    res.status(201).json({ simulatedEmail, nomination: nom });
  });

  app.post('/api/admin/payments', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleMutatePayments(admin.department)) {
      res.status(403).json({
        error: 'Payment creation is restricted to the Official Finance Department and Executive Administrators.',
      });
      return;
    }
    const body = req.body ?? {};
    const payerName = String(body.payerName ?? '').trim();
    const payerEmail = String(body.payerEmail ?? '').trim();
    const description = String(body.description ?? '').trim();
    if (!payerName || !payerEmail || !description) {
      res.status(400).json({ error: 'Payer name, email, and description are required.' });
      return;
    }

    const db = loadDb();
    pushAdminRevision(db, `Added payment record for ${payerName}`, admin.adminName);

    db.lastSequence += 1;
    const now = new Date().toISOString();
    const matchedUser = db.users.find((u) => u.email.toLowerCase() === payerEmail.toLowerCase());
    const amountDue = Number(body.amountDue ?? 0) || 0;
    const amountPaid = Number(body.amountPaid ?? 0) || 0;

    const payment: PaymentRecord = {
      id: `pay-${crypto.randomUUID().slice(0, 8)}`,
      receiptReference: String(body.receiptReference || generateReferenceCode('OR', db.lastSequence, 2027)),
      nominationId: body.nominationId || null,
      userId: matchedUser ? matchedUser.id : null,
      payerName,
      payerEmail,
      payerPhone: String(body.payerPhone ?? '').trim(),
      description,
      amountDue,
      amountPaid,
      currency: 'PHP',
      paymentMethod: String(body.paymentMethod ?? 'Bank Transfer').trim(),
      paymentDate: String(body.paymentDate ?? '').trim(),
      status: (body.status as PaymentStatus) || 'Pending Payment',
      userProofFile: null,
      officialReceiptFile: null,
      adminRemarks: String(body.adminRemarks ?? '').trim(),
      createdAt: now,
      updatedAt: now,
    };

    db.payments.unshift(payment);
    saveDb(db);
    broadcastEvent('payment_updated', { id: payment.id });
    res.status(201).json({ payment });
  });

  app.post('/api/admin/payments/:id/receipt', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleMutatePayments(admin.department)) {
      res.status(403).json({
        error: 'Official Receipt issuance & payment verification belong exclusively to the Official Finance Department and Executive Administrators.',
      });
      return;
    }
    const db = loadDb();
    const payment = db.payments.find((p) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }

    pushAdminRevision(db, `Updated receipt/payment ${payment.receiptReference}`, admin.adminName);

    const body = req.body ?? {};
    if (body.receiptFile?.dataUrl && body.receiptFile?.fileName) {
      try {
        payment.officialReceiptFile = saveBase64Upload({
          fileName: body.receiptFile.fileName,
          dataUrl: body.receiptFile.dataUrl,
          prefix: `official-receipt-${payment.id}`,
        });
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Receipt upload failed.' });
        return;
      }
    }

    if (typeof body.receiptReference === 'string' && body.receiptReference.trim()) {
      payment.receiptReference = body.receiptReference.trim();
    }
    if (body.amountDue !== undefined && Number.isFinite(Number(body.amountDue))) {
      payment.amountDue = Math.max(0, Number(body.amountDue));
    }
    if (body.amountPaid !== undefined && Number.isFinite(Number(body.amountPaid))) {
      payment.amountPaid = Math.max(0, Number(body.amountPaid));
    }
    if (typeof body.paymentMethod === 'string' && body.paymentMethod.trim()) {
      payment.paymentMethod = body.paymentMethod.trim();
    }
    if (typeof body.paymentDate === 'string') {
      payment.paymentDate = body.paymentDate.trim() || new Date().toISOString().slice(0, 10);
    }
    if (typeof body.adminRemarks === 'string') {
      payment.adminRemarks = body.adminRemarks.trim();
    }
    const validStatuses: PaymentStatus[] = [
      'Pending Confirmation',
      'Pending Payment',
      'Receipt Uploaded',
      'Partial',
      'Paid / Verified',
      'Waived',
    ];
    if (body.status && validStatuses.includes(body.status)) {
      payment.status = body.status;
    } else if (payment.officialReceiptFile) {
      payment.status = 'Paid / Verified';
    }

    payment.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastEvent('payment_updated', { id: payment.id });
    res.json({ payment });
  });

  app.delete('/api/admin/payments/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleMutatePayments(admin.department)) {
      res.status(403).json({
        error: 'Deleting payment records is restricted to the Official Finance Department and Executive Administrators.',
      });
      return;
    }
    const db = loadDb();
    const target = db.payments.find((p) => p.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Payment record not found.' });
      return;
    }
    pushAdminRevision(db, `Deleted payment ${target.receiptReference}`, admin.adminName);
    db.payments = db.payments.filter((p) => p.id !== req.params.id);
    saveDb(db);
    broadcastEvent('payment_updated', { deletedId: req.params.id });
    res.json({ ok: true });
  });

  app.put('/api/admin/settings', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const isCertOnlyUpdate =
      admin.department === 'committee' &&
      !body.contactNumber &&
      !body.contactEmail &&
      !body.pricingTiers &&
      !body.headlineTemplate &&
      !body.highlightOfTheMonth &&
      !body.logoUpload &&
      body.resetLogo !== true;
    if (admin.department !== 'executive' && !isCertOnlyUpdate) {
      res.status(403).json({
        error: 'Organization settings updates are restricted to Executive Administrators (Committee on Board may update Certificate Templates only).',
      });
      return;
    }
    const db = loadDb();
    pushAdminRevision(db, 'Updated organization & editorial settings', admin.adminName);

    if (typeof body.contactNumber === 'string' && body.contactNumber.trim()) {
      db.settings.contactNumber = body.contactNumber.trim();
    }
    if (typeof body.contactEmail === 'string' && body.contactEmail.trim()) {
      db.settings.contactEmail = body.contactEmail.trim();
    }
    if (typeof body.officeLocation === 'string') {
      db.settings.officeLocation = body.officeLocation.trim();
    }
    if (typeof body.ceremonySchedule === 'string') {
      db.settings.ceremonySchedule = body.ceremonySchedule.trim();
    }
    if (typeof body.organizationNote === 'string') {
      db.settings.organizationNote = body.organizationNote.trim();
    }
    if (Array.isArray(body.pricingTiers)) {
      db.settings.pricingTiers = body.pricingTiers;
    }
    if (body.headlineTemplate && typeof body.headlineTemplate === 'object') {
      db.settings.headlineTemplate = {
        ...db.settings.headlineTemplate,
        kicker: String(body.headlineTemplate.kicker ?? db.settings.headlineTemplate.kicker).trim(),
        headline: String(body.headlineTemplate.headline ?? db.settings.headlineTemplate.headline).trim(),
        subheadline: String(body.headlineTemplate.subheadline ?? db.settings.headlineTemplate.subheadline).trim(),
        ctaLabel: String(body.headlineTemplate.ctaLabel ?? db.settings.headlineTemplate.ctaLabel).trim(),
        ctaPath: String(body.headlineTemplate.ctaPath ?? db.settings.headlineTemplate.ctaPath).trim() || '/nominate',
        updatedAt: new Date().toISOString(),
      };
    }
    if (body.highlightOfTheMonth && typeof body.highlightOfTheMonth === 'object') {
      db.settings.highlightOfTheMonth = {
        ...db.settings.highlightOfTheMonth,
        monthLabel: String(body.highlightOfTheMonth.monthLabel ?? db.settings.highlightOfTheMonth.monthLabel).trim(),
        title: String(body.highlightOfTheMonth.title ?? db.settings.highlightOfTheMonth.title).trim(),
        honoreeName: String(body.highlightOfTheMonth.honoreeName ?? db.settings.highlightOfTheMonth.honoreeName).trim(),
        category: String(body.highlightOfTheMonth.category ?? db.settings.highlightOfTheMonth.category).trim(),
        summary: String(body.highlightOfTheMonth.summary ?? db.settings.highlightOfTheMonth.summary).trim(),
        impactNote: String(body.highlightOfTheMonth.impactNote ?? db.settings.highlightOfTheMonth.impactNote).trim(),
        ctaLabel: String(body.highlightOfTheMonth.ctaLabel ?? db.settings.highlightOfTheMonth.ctaLabel).trim(),
        ctaPath: String(body.highlightOfTheMonth.ctaPath ?? db.settings.highlightOfTheMonth.ctaPath).trim() || '/about',
        updatedAt: new Date().toISOString(),
      };
    }
    if (body.certificateTemplate && typeof body.certificateTemplate === 'object') {
      const existingCert = db.settings.certificateTemplate ?? {
        templateName: 'Official PEMA Award Certificate Template',
        uploadedImageUrl: null,
        preserveDesignAsIs: true,
        showEditableOverlay: true,
        defaultAwardeeName: 'Dr. Elena M. Villanueva',
        defaultAwardTitle: 'Outstanding Public Health Advocacy Award',
        defaultProfession: 'Public Health Director & Rural Clinic Founder',
        defaultCitationLine:
          'In recognition of exemplary excellence, integrity, and measurable service to the Filipino community.',
        defaultDateLabel: 'Awarded in the 2027 PEMA Ceremonial Cycle',
        defaultSignatoryLine: 'Philippine Excellency & Merit Awards Screening Committee',
        updatedAt: new Date().toISOString(),
      };
      db.settings.certificateTemplate = {
        ...existingCert,
        templateName:
          String(body.certificateTemplate.templateName ?? existingCert.templateName).trim() ||
          existingCert.templateName,
        preserveDesignAsIs:
          typeof body.certificateTemplate.preserveDesignAsIs === 'boolean'
            ? body.certificateTemplate.preserveDesignAsIs
            : existingCert.preserveDesignAsIs,
        showEditableOverlay:
          typeof body.certificateTemplate.showEditableOverlay === 'boolean'
            ? body.certificateTemplate.showEditableOverlay
            : existingCert.showEditableOverlay,
        defaultAwardeeName: String(
          body.certificateTemplate.defaultAwardeeName ?? existingCert.defaultAwardeeName,
        ).trim(),
        defaultAwardTitle: String(
          body.certificateTemplate.defaultAwardTitle ?? existingCert.defaultAwardTitle,
        ).trim(),
        defaultProfession: String(
          body.certificateTemplate.defaultProfession ?? existingCert.defaultProfession,
        ).trim(),
        defaultCitationLine: String(
          body.certificateTemplate.defaultCitationLine ?? existingCert.defaultCitationLine,
        ).trim(),
        defaultDateLabel: String(
          body.certificateTemplate.defaultDateLabel ?? existingCert.defaultDateLabel,
        ).trim(),
        defaultSignatoryLine: String(
          body.certificateTemplate.defaultSignatoryLine ?? existingCert.defaultSignatoryLine,
        ).trim(),
        uploadedImageUrl:
          body.certificateTemplate.uploadedImageUrl !== undefined
            ? body.certificateTemplate.uploadedImageUrl
            : existingCert.uploadedImageUrl,
        updatedAt: new Date().toISOString(),
      };
    }

    if (body.certificateTemplateUpload?.dataUrl && body.certificateTemplateUpload?.fileName) {
      try {
        const uploadedCert = saveBase64Upload({
          fileName: body.certificateTemplateUpload.fileName,
          dataUrl: body.certificateTemplateUpload.dataUrl,
          prefix: 'pema-certificate-template',
        });
        const existingCert = db.settings.certificateTemplate ?? {
          templateName: 'Official PEMA Award Certificate Template',
          uploadedImageUrl: null,
          preserveDesignAsIs: true,
          showEditableOverlay: true,
          defaultAwardeeName: 'Dr. Elena M. Villanueva',
          defaultAwardTitle: 'Outstanding Public Health Advocacy Award',
          defaultProfession: 'Public Health Director & Rural Clinic Founder',
          defaultCitationLine:
            'In recognition of exemplary excellence, integrity, and measurable service to the Filipino community.',
          defaultDateLabel: 'Awarded in the 2027 PEMA Ceremonial Cycle',
          defaultSignatoryLine: 'Philippine Excellency & Merit Awards Screening Committee',
          updatedAt: new Date().toISOString(),
        };
        db.settings.certificateTemplate = {
          ...existingCert,
          uploadedImageUrl: uploadedCert.url,
          updatedAt: new Date().toISOString(),
        };
      } catch (e) {
        res
          .status(400)
          .json({ error: e instanceof Error ? e.message : 'Certificate design upload failed.' });
        return;
      }
    } else if (body.resetCertificateTemplate === true && db.settings.certificateTemplate) {
      db.settings.certificateTemplate = {
        ...db.settings.certificateTemplate,
        uploadedImageUrl: null,
        updatedAt: new Date().toISOString(),
      };
    }

    if (body.logoUpload?.dataUrl && body.logoUpload?.fileName) {
      try {
        const uploaded = saveBase64Upload({
          fileName: body.logoUpload.fileName,
          dataUrl: body.logoUpload.dataUrl,
          prefix: 'pema-official-logo',
        });
        db.settings.customLogoUrl = uploaded.url;
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Logo upload failed.' });
        return;
      }
    } else if (body.resetLogo === true) {
      db.settings.customLogoUrl = null;
    }

    saveDb(db);
    broadcastEvent('settings_updated', { updatedAt: new Date().toISOString() });
    res.json({ settings: db.settings });
  });

  // Admin Awardees Photo Album CRUD (syncs live to public Gallery)
  app.post('/api/admin/awardees', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (admin.department !== 'executive') {
      res.status(403).json({ error: 'Gallery Album updates are restricted to Executive Administrators.' });
      return;
    }
    const body = req.body ?? {};
    const awardeeName = String(body.awardeeName ?? '').trim();
    const awardTitle = String(body.awardTitle ?? '').trim();
    const profession = String(body.profession ?? '').trim();
    const era = body.era === 'Past Awardee' ? 'Past Awardee' : 'New Awardee';
    const yearLabel = String(body.yearLabel ?? (era === 'New Awardee' ? '2026–2027 Honoree' : 'Past Honoree')).trim();

    if (!awardeeName || !awardTitle || !profession) {
      res.status(400).json({ error: 'Awardee name, award title, and profession are required.' });
      return;
    }

    const db = loadDb();
    pushAdminRevision(db, `Added awardee ${awardeeName} to gallery album`, admin.adminName);

    let photoFile: UploadedFileRef | null = null;
    let photoUrl = String(body.photoUrl ?? '/src/assets/images/gallery_trophy_clean_1795064576318.jpg').trim();
    if (body.photoUpload?.dataUrl && body.photoUpload?.fileName) {
      try {
        photoFile = saveBase64Upload({
          fileName: body.photoUpload.fileName,
          dataUrl: body.photoUpload.dataUrl,
          prefix: 'awardee-photo',
        });
        photoUrl = photoFile.url;
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Photo upload failed.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const item: AwardeeGalleryItem = {
      id: `awd-${crypto.randomUUID().slice(0, 8)}`,
      awardeeName,
      awardTitle,
      profession,
      era,
      yearLabel,
      photoFile,
      photoUrl,
      createdAt: now,
      updatedAt: now,
    };

    db.awardees.unshift(item);
    saveDb(db);
    broadcastEvent('settings_updated', { awardeeAdded: item.id });
    res.status(201).json({ awardee: item });
  });

  app.put('/api/admin/awardees/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (admin.department !== 'executive') {
      res.status(403).json({ error: 'Gallery Album updates are restricted to Executive Administrators.' });
      return;
    }
    const db = loadDb();
    const item = db.awardees.find((a) => a.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Awardee entry not found.' });
      return;
    }

    pushAdminRevision(db, `Updated awardee ${item.awardeeName}`, admin.adminName);
    const body = req.body ?? {};
    if (typeof body.awardeeName === 'string' && body.awardeeName.trim()) {
      item.awardeeName = body.awardeeName.trim();
    }
    if (typeof body.awardTitle === 'string' && body.awardTitle.trim()) {
      item.awardTitle = body.awardTitle.trim();
    }
    if (typeof body.profession === 'string' && body.profession.trim()) {
      item.profession = body.profession.trim();
    }
    if (body.era === 'New Awardee' || body.era === 'Past Awardee') {
      item.era = body.era;
    }
    if (typeof body.yearLabel === 'string' && body.yearLabel.trim()) {
      item.yearLabel = body.yearLabel.trim();
    }
    if (body.photoUpload?.dataUrl && body.photoUpload?.fileName) {
      try {
        const uploaded = saveBase64Upload({
          fileName: body.photoUpload.fileName,
          dataUrl: body.photoUpload.dataUrl,
          prefix: 'awardee-photo',
        });
        item.photoFile = uploaded;
        item.photoUrl = uploaded.url;
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'Photo upload failed.' });
        return;
      }
    }
    item.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastEvent('settings_updated', { awardeeUpdated: item.id });
    res.json({ awardee: item });
  });

  app.delete('/api/admin/awardees/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (admin.department !== 'executive') {
      res.status(403).json({ error: 'Gallery Album updates are restricted to Executive Administrators.' });
      return;
    }
    const db = loadDb();
    const target = db.awardees.find((a) => a.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Awardee entry not found.' });
      return;
    }
    pushAdminRevision(db, `Removed awardee ${target.awardeeName}`, admin.adminName);
    db.awardees = db.awardees.filter((a) => a.id !== req.params.id);
    saveDb(db);
    broadcastEvent('settings_updated', { awardeeDeleted: req.params.id });
    res.json({ ok: true });
  });

  // Admin-Only Internal Credentials & Legitimacy / Registration Proof Vault (Never Public)
  app.post('/api/admin/credentials', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const body = req.body ?? {};
    const title = String(body.title ?? '').trim();
    const issuingAuthority = String(body.issuingAuthority ?? '').trim();
    const registrationNumber = String(body.registrationNumber ?? '').trim();
    const details = String(body.details ?? '').trim();
    const status = body.status === 'Internal Verified' ? 'Internal Verified' : 'Pending Review';

    if (!title || !issuingAuthority) {
      res.status(400).json({ error: 'Document title and issuing authority are required.' });
      return;
    }

    const db = loadDb();
    pushAdminRevision(db, `Added legitimacy proof "${title}"`, admin.adminName);

    let attachmentFile: UploadedFileRef | null = null;
    if (body.fileUpload?.dataUrl && body.fileUpload?.fileName) {
      try {
        attachmentFile = saveBase64Upload({
          fileName: body.fileUpload.fileName,
          dataUrl: body.fileUpload.dataUrl,
          prefix: 'legitimacy-proof',
        });
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'File upload failed.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const item: LegitimacyCredential = {
      id: `crd-${crypto.randomUUID().slice(0, 8)}`,
      title,
      issuingAuthority,
      registrationNumber,
      details,
      status,
      attachmentFile,
      createdAt: now,
      updatedAt: now,
    };

    db.legitimacyCredentials.unshift(item);
    saveDb(db);
    res.status(201).json({ credential: item });
  });

  app.put('/api/admin/credentials/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const db = loadDb();
    const item = db.legitimacyCredentials.find((c) => c.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Credential entry not found.' });
      return;
    }
    pushAdminRevision(db, `Edited legitimacy proof "${item.title}"`, admin.adminName);

    const body = req.body ?? {};
    if (typeof body.title === 'string' && body.title.trim()) item.title = body.title.trim();
    if (typeof body.issuingAuthority === 'string' && body.issuingAuthority.trim()) {
      item.issuingAuthority = body.issuingAuthority.trim();
    }
    if (typeof body.registrationNumber === 'string') {
      item.registrationNumber = body.registrationNumber.trim();
    }
    if (typeof body.details === 'string') item.details = body.details.trim();
    if (body.status === 'Internal Verified' || body.status === 'Pending Review') {
      item.status = body.status;
    }
    if (body.fileUpload?.dataUrl && body.fileUpload?.fileName) {
      try {
        item.attachmentFile = saveBase64Upload({
          fileName: body.fileUpload.fileName,
          dataUrl: body.fileUpload.dataUrl,
          prefix: 'legitimacy-proof',
        });
      } catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : 'File upload failed.' });
        return;
      }
    }
    item.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ credential: item });
  });

  app.delete('/api/admin/credentials/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const db = loadDb();
    const target = db.legitimacyCredentials.find((c) => c.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Credential entry not found.' });
      return;
    }
    pushAdminRevision(db, `Deleted legitimacy proof "${target.title}"`, admin.adminName);
    db.legitimacyCredentials = db.legitimacyCredentials.filter((c) => c.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  // Admin Chat Support Console Endpoints
  app.post('/api/admin/support/availability', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const db = loadDb();
    db.supportAvailable = Boolean(req.body?.available);
    saveDb(db);
    broadcastEvent('support_status_updated', { supportAvailable: db.supportAvailable });
    res.json({ supportAvailable: db.supportAvailable });
  });

  app.post('/api/admin/chat/:threadId/reply', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const db = loadDb();
    const thread = db.chatThreads.find((t) => t.id === req.params.threadId);
    if (!thread) {
      res.status(404).json({ error: 'Support ticket thread not found.' });
      return;
    }

    const body = req.body ?? {};
    const text = String(body.text ?? '').trim();
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!text && rawAttachments.length === 0) {
      res.status(400).json({ error: 'Please type a reply or attach a file/photo.' });
      return;
    }

    const savedAttachments: UploadedFileRef[] = [];
    for (const item of rawAttachments.slice(0, MAX_CHAT_ATTACHMENTS)) {
      if (item?.dataUrl && item?.fileName) {
        try {
          savedAttachments.push(
            saveBase64Upload({
              fileName: item.fileName,
              dataUrl: item.dataUrl,
              prefix: `chat-admin-${thread.ticketNumber}`,
            }),
          );
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : 'Attachment upload failed.' });
          return;
        }
      }
    }

    const now = new Date().toISOString();
    thread.messages.push({
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      senderRole: 'admin',
      // Do not expose Princess / Jreal names on public/customer side
      senderDisplayName: 'PEMA Support Desk',
      text: text || '(Sent file/photo attachment)',
      attachments: savedAttachments,
      sentAt: now,
    });
    if (body.markResolved === true) {
      thread.status = 'Resolved';
    } else {
      thread.status = 'Active';
    }
    thread.updatedAt = now;

    saveDb(db);
    broadcastEvent('chat_updated', { threadId: thread.id, ticketNumber: thread.ticketNumber });
    res.json({ thread });
  });

  // =========================================================================
  // Separated Departmental Endpoints (Project Funding, Finance Clearance,
  // Committee on Board 4-Evaluator Panel, & Executive Passcode Control)
  // =========================================================================

  // 1. Project Funding Department CRUD
  app.post('/api/admin/funding', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleMutateFunding(admin.department)) {
      res.status(403).json({
        error: 'Project Funding mutations are restricted to the PEMA Project Funding Department and Executive Administrators.',
      });
      return;
    }
    const body = req.body ?? {};
    const title = String(body.title ?? '').trim();
    const sourceOrSponsor = String(body.sourceOrSponsor ?? '').trim();
    if (!title || !sourceOrSponsor) {
      res.status(400).json({ error: 'Initiative title and sponsor/funding source are required.' });
      return;
    }

    const db = loadDb();
    pushAdminRevision(db, `Added project funding "${title}"`, admin.adminName);
    db.lastSequence += 1;
    const now = new Date().toISOString();
    const item: ProjectFundingRecord = {
      id: `fund-${crypto.randomUUID().slice(0, 8)}`,
      programCode: generateReferenceCode('FUND', db.lastSequence, 2027),
      title,
      sourceOrSponsor,
      fundingType: (body.fundingType as ProjectFundingType) || 'Ceremony Sponsorship',
      targetAmountPhp: Math.max(0, Number(body.targetAmountPhp ?? 0) || 0),
      committedAmountPhp: Math.max(0, Number(body.committedAmountPhp ?? 0) || 0),
      disbursedAmountPhp: Math.max(0, Number(body.disbursedAmountPhp ?? 0) || 0),
      financeClearanceStatus: 'Pending Finance Review',
      status: (body.status as ProjectFundingStatus) || 'Proposed',
      notes: String(body.notes ?? '').trim(),
      updatedBy: admin.adminName,
      createdAt: now,
      updatedAt: now,
    };

    db.projectFunding.unshift(item);
    saveDb(db);
    broadcastEvent('funding_updated', { id: item.id });
    res.status(201).json({ funding: item });
  });

  app.put('/api/admin/funding/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleMutateFunding(admin.department)) {
      res.status(403).json({
        error: 'Project Funding edits are restricted to the PEMA Project Funding Department and Executive Administrators.',
      });
      return;
    }
    const db = loadDb();
    const item = db.projectFunding.find((f) => f.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Project funding record not found.' });
      return;
    }
    pushAdminRevision(db, `Updated project funding "${item.title}"`, admin.adminName);

    const body = req.body ?? {};
    if (typeof body.title === 'string' && body.title.trim()) item.title = body.title.trim();
    if (typeof body.sourceOrSponsor === 'string' && body.sourceOrSponsor.trim()) {
      item.sourceOrSponsor = body.sourceOrSponsor.trim();
    }
    if (typeof body.fundingType === 'string' && body.fundingType.trim()) {
      item.fundingType = body.fundingType as ProjectFundingType;
    }
    if (body.targetAmountPhp !== undefined && Number.isFinite(Number(body.targetAmountPhp))) {
      item.targetAmountPhp = Math.max(0, Number(body.targetAmountPhp));
    }
    if (body.committedAmountPhp !== undefined && Number.isFinite(Number(body.committedAmountPhp))) {
      item.committedAmountPhp = Math.max(0, Number(body.committedAmountPhp));
    }
    if (body.disbursedAmountPhp !== undefined && Number.isFinite(Number(body.disbursedAmountPhp))) {
      item.disbursedAmountPhp = Math.max(0, Number(body.disbursedAmountPhp));
    }
    if (typeof body.status === 'string' && body.status.trim()) {
      item.status = body.status as ProjectFundingStatus;
    }
    if (typeof body.notes === 'string') {
      item.notes = body.notes.trim();
    }
    item.updatedBy = admin.adminName;
    item.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastEvent('funding_updated', { id: item.id });
    res.json({ funding: item });
  });

  app.delete('/api/admin/funding/:id', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleMutateFunding(admin.department)) {
      res.status(403).json({
        error: 'Deleting funding initiatives is restricted to the Project Funding Department and Executive Administrators.',
      });
      return;
    }
    const db = loadDb();
    const target = db.projectFunding.find((f) => f.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Project funding record not found.' });
      return;
    }
    pushAdminRevision(db, `Deleted project funding ${target.programCode}`, admin.adminName);
    db.projectFunding = db.projectFunding.filter((f) => f.id !== req.params.id);
    saveDb(db);
    broadcastEvent('funding_updated', { deletedId: req.params.id });
    res.json({ ok: true });
  });

  // 2. Official Finance Department Treasury Clearance on Project Funding
  app.patch('/api/admin/funding/:id/finance-clearance', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (!canRoleClearFundingFinance(admin.department)) {
      res.status(403).json({
        error: 'Treasury clearance on project funds belongs exclusively to the Official Finance Department and Executive Administrators.',
      });
      return;
    }
    const db = loadDb();
    const item = db.projectFunding.find((f) => f.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Project funding record not found.' });
      return;
    }
    pushAdminRevision(db, `Updated Finance clearance on ${item.programCode}`, admin.adminName);
    const clearance =
      req.body?.financeClearanceStatus === 'Finance Verified'
        ? 'Finance Verified'
        : 'Pending Finance Review';
    item.financeClearanceStatus = clearance;
    item.updatedBy = `${admin.adminName} (Finance Clearance)`;
    item.updatedAt = new Date().toISOString();
    saveDb(db);
    broadcastEvent('funding_updated', { id: item.id });
    res.json({ funding: item });
  });

  // 3. Committee on Board — 4 Evaluators Independent Rubric Scoring (100%)
  app.put('/api/admin/evaluations/:nominationId', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    const slotRaw = String(req.body?.evaluatorSlot ?? '') as EvaluatorSlot;
    if (!EVALUATOR_SLOTS.includes(slotRaw)) {
      res.status(400).json({ error: 'Valid evaluator slot (evaluator_1 through evaluator_4) is required.' });
      return;
    }
    if (!canRoleScoreEvaluatorSlot(admin.department, slotRaw)) {
      res.status(403).json({
        error: `Access denied. You may only submit scores for your assigned Evaluator seat (${admin.department}).`,
      });
      return;
    }

    const db = loadDb();
    const nom = db.nominations.find((n) => n.id === req.params.nominationId);
    if (!nom) {
      res.status(404).json({ error: 'Nomination dossier not found.' });
      return;
    }

    pushAdminRevision(db, `Saved ${slotRaw} rubric score for ${nom.referenceCode}`, admin.adminName);
    const { breakdown, totalScore } = normalizeCriteriaScores(req.body?.criteriaScores ?? {});
    const recRaw = String(req.body?.recommendation ?? 'Recommend Approval');
    const recommendation: EvaluatorRecommendation =
      recRaw === 'Not Recommended' || recRaw === 'For Board Deliberation'
        ? recRaw
        : 'Recommend Approval';
    const slotIndex = EVALUATOR_SLOTS.indexOf(slotRaw) + 1;
    const evaluatorLabel = `Evaluator ${slotIndex}`;
    const evaluatorName = String(req.body?.evaluatorName ?? admin.adminName).trim() || admin.adminName;
    const remarks = String(req.body?.remarks ?? '').trim();
    const now = new Date().toISOString();

    const existing = db.nominationEvaluations.find(
      (e) => e.nominationId === nom.id && e.evaluatorSlot === slotRaw,
    );
    let saved: NominationEvaluationScore;
    if (existing) {
      existing.evaluatorName = evaluatorName;
      existing.criteriaScores = breakdown;
      existing.totalScore = totalScore;
      existing.recommendation = recommendation;
      existing.remarks = remarks;
      existing.updatedAt = now;
      saved = existing;
    } else {
      saved = {
        id: `eval-${crypto.randomUUID().slice(0, 8)}`,
        nominationId: nom.id,
        evaluatorSlot: slotRaw,
        evaluatorLabel,
        evaluatorName,
        criteriaScores: breakdown,
        totalScore,
        recommendation,
        remarks,
        updatedAt: now,
      };
      db.nominationEvaluations.unshift(saved);
    }

    if (nom.status === 'Pending' || nom.status === 'Submitted') {
      nom.status = 'Under Evaluation';
      nom.updatedAt = now;
    }

    saveDb(db);
    broadcastEvent('nomination_updated', { id: nom.id, evaluatorSlot: slotRaw });
    res.json({ evaluation: saved });
  });

  // 4. Executive Admin: Update Departmental Access Passcodes
  app.put('/api/admin/departments/passcodes', (req, res) => {
    const admin = getAdminSession(req);
    if (!admin.isAdmin || !admin.adminName) {
      res.status(401).json({ error: 'Administrator authentication required.' });
      return;
    }
    if (admin.department !== 'executive') {
      res.status(403).json({ error: 'Only Executive Administrators may modify department access passcodes.' });
      return;
    }
    const incoming = req.body?.passcodes;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Invalid department passcodes payload.' });
      return;
    }

    const db = loadDb();
    for (const key of Object.keys(incoming)) {
      if (isValidDepartmentAccessRole(key)) {
        const val = String(incoming[key] ?? '').trim();
        if (val.length < 6) {
          res.status(400).json({ error: `Passcode for ${DEPARTMENT_ROLE_CATALOG[key].title} must be at least 6 characters.` });
          return;
        }
        db.departmentPasscodes[key] = val;
      }
    }

    saveDb(db);
    res.json({ departmentPasscodes: db.departmentPasscodes });
  });

  // Vite / Static Asset Serving
  if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'public')));
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PEMA Fullstack Portal listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
