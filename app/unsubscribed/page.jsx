export const metadata = { title: 'Unsubscribed', robots: { index: false, follow: false } };

export default async function Unsubscribed({ searchParams }) {
  const unknown = (await searchParams)?.unknown === '1';
  return (
    <section>
      <div className="wrap prose">
        <h1>{unknown ? 'We couldn’t match that link' : 'You’re unsubscribed'}</h1>
        {unknown
          ? <p>The link may be incomplete. Email <a href="mailto:support@mazidigroup.com">support@mazidigroup.com</a> with the word “stop” and we’ll remove you straight away.</p>
          : <p>We won’t contact you again. Your address is on our do-not-contact list, which is the only way we can make sure of that. If this was a mistake, email <a href="mailto:support@mazidigroup.com">support@mazidigroup.com</a>.</p>}
      </div>
    </section>
  );
}
