// Reply classification. Rules only, no model: a reply is data, never an
// instruction, and anything the rules cannot place goes to the owner as
// UNCLASSIFIED with human_action_required = true. The cost of a wrong
// automatic decision (missing a "stop", or halting a warm lead) is far higher
// than the cost of the owner reading an email.

const norm = s => String(s || '').replace(/\r/g, '').toLowerCase();

/** Strip quoted history and signatures so we classify what THEY wrote. */
export function ownWords(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [];
  for (const l of lines) {
    if (/^\s*(on .+wrote:|from:|sent:|-----original message-----|--\s*$|__+$)/i.test(l)) break;
    if (/^\s*>/.test(l)) continue;
    out.push(l);
  }
  return out.join('\n').trim();
}

export function classify({ subject, text, headers = {}, fromEmail }) {
  const own = norm(ownWords(text));
  const subj = norm(subject);
  const from = norm(fromEmail);
  const h = k => norm(headers[k]);

  // Machine mail first.
  if (/mailer-daemon|postmaster@|no-?reply@.*(bounce|delivery)/.test(from) || /delivery (status|failure)|undeliverable|returned mail|mail delivery failed/.test(subj))
    return { classification: 'BOUNCE', confidence: 0.95, summary: 'Delivery failure notification', human: false };
  if (h('auto-submitted') && h('auto-submitted') !== 'no' || h('x-autoreply') || h('x-autorespond') || /^(auto|automatic reply|out of office|out of the office)/.test(subj) || /\b(out of (the )?office|on annual leave|away from the office|currently out of|limited access to (my )?email)\b/.test(own))
    return { classification: 'OUT_OF_OFFICE', confidence: 0.9, summary: 'Automatic out-of-office reply', human: false };

  // Objection. Broad on purpose; a false positive here costs one lead, a
  // false negative costs a complaint.
  if (/\b(unsubscribe|remove (me|us)|take (me|us) off|stop (emailing|contacting|sending)|do not (contact|email)|don'?t (contact|email)|no more emails|opt ?out|gdpr|data protection|spam|not interested|no thanks|no thank you|not for us|please stop)\b/.test(own) || /^\s*stop\s*[.!]?\s*$/m.test(own) || /\b(unsubscribe|stop|remove)\b/.test(subj))
    return { classification: /\b(unsubscribe|remove|stop|opt ?out|do not|don'?t|gdpr|spam)\b/.test(own + ' ' + subj) ? 'UNSUBSCRIBE' : 'NEGATIVE', confidence: 0.85, summary: 'Recipient declined or asked us to stop', human: false };

  if (/\b(already (have|use|got|covered|sorted)|we (use|have|are with)|our it (company|provider|support)|in[- ]house it|managed service|already (backed|backing) up)\b/.test(own))
    return { classification: 'ALREADY_COVERED', confidence: 0.7, summary: 'Says they already have backup or IT cover', human: true };
  if (/\b(wrong person|not the right person|you should (speak|talk) to|forward(ed)? (this|your email) to|passed (this|it) on to|our (it|office) manager is)\b/.test(own))
    return { classification: 'REFERRAL', confidence: 0.7, summary: 'Points to someone else', human: true };
  if (/\b(not (right )?now|maybe (later|next)|come back (in|to me)|busy (period|time)|after (the )?(year end|january|tax season)|try again)\b/.test(own))
    return { classification: 'NOT_NOW', confidence: 0.7, summary: 'Interested in principle, not now', human: true };
  if (/\b(yes|sure|sounds (good|useful|interesting)|happy to|let'?s (talk|arrange|book)|give me a call|call me|when (are you|would you be) (free|available)|interested|book (a|the) (call|check)|please (call|ring))\b/.test(own))
    return { classification: 'POSITIVE_INTERESTED', confidence: 0.75, summary: 'Positive: wants the backup check or a call', human: true };
  if (/\?/.test(own) || /\b(how much|what does it cost|price|pricing|what exactly|can you explain)\b/.test(own))
    return { classification: 'QUESTION', confidence: 0.7, summary: 'Asks a question', human: true };

  return { classification: 'UNCLASSIFIED', confidence: 0.3, summary: 'Could not classify; read it', human: true };
}
