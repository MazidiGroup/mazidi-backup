import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { serverClient } from '../../../../lib/supabase';
import { classify, ownWords } from '../../../../lib/replies';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function authorised(request) {
  const secret = (process.env.CRON_SECRET || '').trim();
  const supplied = (request.headers.get('authorization') || '').trim().replace(/^Bearer\s+/i, '').trim();
  if (!secret) return { ok: false, reason: 'CRON_SECRET is not set on this deployment' };
  if (!supplied) return { ok: false, reason: 'No bearer token was sent' };
  return supplied === secret ? { ok: true } : { ok: false, reason: 'Bearer token did not match CRON_SECRET' };
}

// Only mail from a known prospect is touched. Everything else in the inbox
// (customers, suppliers, personal) is left exactly as it is: not read, not
// marked, not stored.
export async function GET(request) {
  const auth = authorised(request);
  if (!auth.ok) return Response.json({ error: 'Unauthorised', reason: auth.reason }, { status: 401 });
  const dryRun = new URL(request.url).searchParams.get('dry') === '1';

  const host = (process.env.IMAP_HOST || '').trim(), user = (process.env.IMAP_USER || '').trim(), pass = process.env.IMAP_PASSWORD || '';
  const report = { dryRun, mailbox: host ? 'configured' : 'off (IMAP_* not set)', scanned: 0, matched: 0, recorded: 0, skipped: {}, replies: [], errors: [] };
  const skip = why => { report.skipped[why] = (report.skipped[why] ?? 0) + 1; };
  if (!host || !user || !pass) return Response.json(report);

  const db = serverClient();
  // Everyone we have ever emailed, plus their domains, so a reply from a
  // colleague at the same firm is still matched.
  const { data: contacts } = await db.from('contacts').select('contact_id, company_id, email');
  const byEmail = new Map((contacts ?? []).map(c => [c.email.toLowerCase(), c]));
  const { data: companies } = await db.from('companies').select('company_id, domain').not('domain', 'is', null);
  const byDomain = new Map((companies ?? []).map(c => [c.domain.toLowerCase(), c]));
  const { data: seen } = await db.from('replies').select('full_message').gte('received_at', new Date(Date.now() - 30 * 86400 * 1000).toISOString());
  const seenIds = new Set((seen ?? []).map(r => (r.full_message.match(/^Message-ID: (.+)$/m) || [])[1]).filter(Boolean));

  const client = new ImapFlow({ host, port: 993, secure: true, auth: { user, pass }, logger: false });
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - 14 * 86400 * 1000);
      for await (const msg of client.fetch({ since }, { envelope: true, source: true })) {
        report.scanned++;
        const from = (msg.envelope?.from?.[0]?.address || '').toLowerCase();
        const domain = from.split('@')[1] || '';
        const contact = byEmail.get(from);
        const company = contact ? null : [...byDomain.entries()].find(([d]) => domain === d || domain.endsWith('.' + d))?.[1];
        const isBounce = /mailer-daemon|postmaster@/.test(from);
        if (!contact && !company && !isBounce) { skip('not a prospect'); continue; }

        const parsed = await simpleParser(msg.source);
        const messageId = parsed.messageId || `imap-${msg.uid}`;
        if (seenIds.has(messageId)) { skip('already recorded'); continue; }
        report.matched++;

        const headers = Object.fromEntries([...parsed.headers.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : v?.value ?? JSON.stringify(v)]));
        const text = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '';
        const cls = classify({ subject: parsed.subject, text, headers, fromEmail: from });

        // Which outreach is this replying to? Latest sent message to that company.
        const companyId = contact?.company_id ?? company?.company_id ?? null;
        let outreachId = null;
        if (companyId) {
          const { data: o } = await db.from('outreach').select('outreach_id').eq('company_id', companyId).in('delivery_status', ['SENT', 'DELIVERED']).order('sent_at', { ascending: false }).limit(1);
          outreachId = o?.[0]?.outreach_id ?? null;
        }
        if (isBounce && !companyId) { skip('bounce for unknown address'); continue; }
        if (cls.classification === 'OUT_OF_OFFICE') { skip('out of office'); }

        const row = {
          outreach_id: outreachId, company_id: companyId, contact_id: contact?.contact_id ?? null,
          from_email: from, received_at: (parsed.date ?? new Date()).toISOString(), subject: parsed.subject ?? null,
          full_message: `Message-ID: ${messageId}\n\n${text}`.slice(0, 20000),
          classification: cls.classification, classifier_confidence: cls.confidence, summary: cls.summary,
          human_action_required: cls.human
        };
        report.replies.push({ from, subject: parsed.subject, classification: cls.classification, excerpt: ownWords(text).slice(0, 160) });
        if (dryRun) continue;

        const { error } = await db.from('replies').insert(row); // trigger replies_halt_sequence does the rest
        if (error) { report.errors.push(`${from}: ${error.message}`); continue; }
        if (outreachId && cls.classification !== 'OUT_OF_OFFICE') await db.from('outreach').update({ replied: true, replied_at: row.received_at }).eq('outreach_id', outreachId);
        if (cls.classification === 'BOUNCE' && contact) await db.from('contacts').update({ hard_bounced: true }).eq('contact_id', contact.contact_id);
        await db.from('activity_log').insert({
          actor: 'SYSTEM:reply-processor', action: 'REPLY_RECEIVED', entity_type: 'replies', company_id: companyId,
          detail: { from, subject: parsed.subject, classification: cls.classification, confidence: cls.confidence, human_action_required: cls.human },
          outcome: cls.classification
        });
        report.recorded++;
      }
    } finally { lock.release(); }
  } catch (e) {
    report.errors.push(`IMAP: ${e.message}`);
  } finally {
    try { await client.logout(); } catch {}
  }
  report.outreachTriggered = false;
  return Response.json(report);
}
