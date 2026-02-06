import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export function Return() {
  const [status, setStatus] = useState(null);
  const [customerEmail, setCustomerEmail] = useState('');

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const sessionId = urlParams.get('session_id');

    fetch(`/api/session-status?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data.status);
        setCustomerEmail(data.customer_email);
      });
  }, []);

  if (status === 'open') {
    return (
      <Navigate to="/checkout" />
    )
  }

  if (status === 'complete') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">
        <section id="success" className="text-center p-8 bg-slate-900 rounded-3xl border border-emerald-500/30">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold mb-4">Bienvenue dans l'Élite !</h1>
          <p className="text-slate-300 mb-8">
            Ton inscription est validée. Un email de confirmation a été envoyé à <strong>{customerEmail}</strong>.
          </p>
          <a href="/" className="bg-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-500 transition">
            Accéder à mon espace
          </a>
        </section>
      </div>
    )
  }

  return null;
}