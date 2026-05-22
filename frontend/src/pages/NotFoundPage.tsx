import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>404</h1>
        <p>The page you are looking for does not exist.</p>
        <Link to="/" className="btn btn-gradient full-width">
          Go to Home
        </Link>
      </section>
    </main>
  );
}
