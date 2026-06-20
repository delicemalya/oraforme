'use client'

import * as Sentry from '@sentry/nextjs'
import { useState } from 'react'

export default function SentryExamplePage() {
  const [triggered, setTriggered] = useState(false)

  function triggerError() {
    setTriggered(true)
    Sentry.captureException(new Error('Test Sentry — Oraforme Next.js'))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <div className="text-4xl mb-4">🛡️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Test Sentry</h1>
        <p className="text-gray-500 text-sm mb-6">
          Clique le bouton pour envoyer une erreur test à Sentry et vérifier que la connexion fonctionne.
        </p>

        {triggered ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-700 font-semibold text-sm">
              ✅ Erreur envoyée — vérifie dans Sentry Issues
            </p>
          </div>
        ) : (
          <button
            onClick={triggerError}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Déclencher une erreur test
          </button>
        )}

        <p className="text-xs text-gray-400 mt-4">
          Page de vérification Sentry · Ne pas exposer en production
        </p>
      </div>
    </div>
  )
}
