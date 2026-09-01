import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default function Login() {
  return (
    <div className="admin-login">
      <h1>Owner sign-in</h1>
      <p className="small">The dashboard is for Aimal only. Enter the admin secret set in Vercel.</p>
      <LoginForm />
    </div>
  );
}
