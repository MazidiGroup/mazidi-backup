// App acquisition content and audience rules. Billing remains in the iOS apps.
export const APP_CATALOG = Object.freeze({
  fmc: {
    name: "Fitness Muscle Coach",
    brand: "Mazidi Group",
    audience: "personal_trainer",
    url: "https://apps.apple.com/us/app/fitness-muscle-coach/id6799203774",
    from: "Aimal at Mazidi Group <aimal@mazidigroup.com>",
    replyTo: "support@mazidigroup.com",
    address: "Flat 55 Banstead Court, 60 Westway, London W12 0QJ",
    invitation: {
      subject: "Your clients’ training, in one place",
      body: "Fitness Muscle Coach helps personal trainers and coaches organise client programmes, workouts and check-ins. Keep your coaching and your clients’ training connected in one iOS app.",
    },
    followup: {
      subject: "A quick follow-up about Fitness Muscle Coach",
      body: "If you’re looking for a way to organise your clients’ training and check-ins, here is Fitness Muscle Coach again. You can explore the app and its subscription options on the App Store.",
    },
    searches: [
      "personal trainers London",
      "personal training coaches Manchester",
      "personal trainers Birmingham",
      "personal trainers Bristol",
      "personal trainers Leeds",
      "personal trainers Edinburgh",
    ],
  },
  musclemap: {
    name: "MuscleMap",
    brand: "Mazidi Group",
    audience: "gym_user",
    url: "https://apps.apple.com/us/app/muscle-map-workout-anatomy/id6786005405",
    from: "Aimal at Mazidi Group <aimal@mazidigroup.com>",
    replyTo: "support@mazidigroup.com",
    address: "Flat 55 Banstead Court, 60 Westway, London W12 0QJ",
    invitation: {
      subject: "Understand your exercises. Track your workouts.",
      body: "MuscleMap combines workout tracking with muscle anatomy to help you understand the muscles you train and keep a record of your gym sessions. It is a standalone iOS app with subscription options.",
    },
    followup: {
      subject: "A quick follow-up about MuscleMap",
      body: "Here is the MuscleMap link again if you would like to explore workout tracking and muscle anatomy for your gym sessions. Details and subscription options are on the App Store.",
    },
    searches: [
      "strength training gyms London",
      "weightlifting gyms Manchester",
      "fitness gyms Birmingham",
      "strength training gyms Bristol",
      "weightlifting gyms Leeds",
      "fitness gyms Edinburgh",
    ],
  },
  rera: {
    name: "RERA Exam Prep Dubai",
    brand: "Mazidi Homes",
    audience: "dubai_exam_candidate",
    url: "https://apps.apple.com/us/app/rera-exam-prep-dubai/id6798309101",
    from: "Aimal at Mazidi Homes <aimal@mazidihomes.com>",
    replyTo: "aimal@mazidihomes.com",
    address: "Office 503-A, Buhaleeba Plaza, Al Murqabat, Dubai, UAE",
    invitation: {
      subject: "Preparing for the Dubai real estate broker exam",
      body: "RERA Exam Prep Dubai is a paid iOS study app for people preparing for Dubai’s real estate broker exam. Use practice questions and revision tools to help structure your preparation.",
    },
    followup: {
      subject: "A quick follow-up about RERA Exam Prep Dubai",
      body: "If you are still preparing for the Dubai real estate broker exam, here is the RERA Exam Prep Dubai link again. Explore the study tools and current purchase details on the App Store.",
    },
    searches: [
      "real estate broker training Dubai",
      "RERA exam training Dubai",
      "real estate training courses Dubai",
      "real estate agent academy Dubai",
    ],
  },
});

export function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function validateAppLead(input, now = new Date()) {
  const app = APP_CATALOG[input?.app_key];
  if (!app || input.audience !== app.audience)
    throw new Error("Choose one app and its matching audience.");
  const email = normalizeEmail(input.email);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254)
    throw new Error("A valid email address is required.");
  if (input.ios_interest !== true)
    throw new Error("Confirm interest in using the iOS app.");
  if (
    input.consent_app_key !== input.app_key ||
    input.permission_state !== "opted_in"
  )
    throw new Error("App-specific email permission is required.");
  for (const key of ["consent_source", "consent_text"]) {
    if (
      typeof input[key] !== "string" ||
      input[key].trim().length < 10 ||
      input[key].length > 4000
    )
      throw new Error(`Provide the ${key.replaceAll("_", " ")}.`);
  }
  for (const key of ["consent_at", "email_verified_at"]) {
    const date = new Date(input[key]);
    if (!input[key] || !Number.isFinite(date.getTime()) || date > now)
      throw new Error(`A valid ${key.replaceAll("_", " ")} is required.`);
  }
  if (now - new Date(input.email_verified_at) > 180 * 86400000)
    throw new Error("Email verification must be within the last 180 days.");
  const personKey =
    input.person_key == null ? null : String(input.person_key).trim();
  if (personKey !== null && (!personKey || personKey.length > 250))
    throw new Error("Invalid person identifier.");
  return {
    email,
    first_name: String(input.first_name || "")
      .replace(/[\r\n<>]/g, "")
      .trim()
      .slice(0, 80),
    app_key: input.app_key,
    audience: input.audience,
    ios_interest: true,
    person_key: personKey,
    permission_state: "opted_in",
    consent_app_key: input.app_key,
    consent_source: input.consent_source.trim(),
    consent_text: input.consent_text.trim(),
    consent_at: new Date(input.consent_at).toISOString(),
    email_verified_at: new Date(input.email_verified_at).toISOString(),
  };
}

export function renderAppMessage({
  app_key,
  sequence_step,
  first_name,
  unsubscribeUrl,
}) {
  const app = APP_CATALOG[app_key];
  if (!app || ![1, 2].includes(sequence_step))
    throw new Error("Invalid app or sequence step.");
  const copy = sequence_step === 1 ? app.invitation : app.followup;
  const name = String(first_name || "there")
    .replace(/[\r\n<>]/g, "")
    .slice(0, 80);
  const extra =
    app_key === "rera"
      ? "\n\nIndependent study aid; not affiliated with DLD or RERA. Exam results are not guaranteed."
      : "";
  const text = `Hi ${name},\n\n${copy.body}\n\nView ${app.name} and download it on the App Store:\n${app.url}${extra}\n\nAimal\n${app.brand}\n${app.replyTo}\n${app.address}\n\nYou opted in to emails about ${app.name}. Reply to this email with any questions. To stop promotional emails from us, unsubscribe here:\n${unsubscribeUrl}`;
  return { from: app.from, reply_to: app.replyTo, subject: copy.subject, text };
}

// A provider timeout is uncertain, so the worker never automatically resends it.
// The immutable message ID is also sent as Resend's 24-hour idempotency key.
export async function deliverAppMessage(message, fetcher = fetch) {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) throw new Error("Resend is not configured.");
  const response = await fetcher("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(20000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `app-growth/${message.message_id}`,
    },
    body: JSON.stringify(message.payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id)
    throw new Error(
      `Resend delivery could not be confirmed (${response.status}).`,
    );
  return result.id;
}
