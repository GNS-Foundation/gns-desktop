/**
 * Welcome Screen - Onboarding for new users
 */

import { useState } from 'react';
import { KeyRound, MapPin, MessageCircle, Shield, ArrowRight, Import } from 'lucide-react';
import { generateIdentity, importIdentity } from '../lib/tauri';

interface WelcomeScreenProps {
  onComplete: () => void;
}

export function WelcomeScreen({ onComplete }: WelcomeScreenProps) {
  const [step, setStep] = useState<'intro' | 'create' | 'import'>('intro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importKey, setImportKey] = useState('');

  const handleCreate = async () => {
    try {
      setLoading(true);
      setError(null);
      await generateIdentity();
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create identity');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importKey.trim()) {
      setError('Please enter your private key');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await importIdentity(importKey.trim());
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import identity');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'import') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col p-6">
        <button
          onClick={() => setStep('intro')}
          className="text-slate-400 mb-8"
        >
          ← Back
        </button>

        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <h1 className="text-2xl font-bold mb-2">Import Identity</h1>
          <p className="text-slate-400 mb-8">
            Enter your 64-character private key to restore your identity.
          </p>

          <textarea
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            placeholder="Enter private key (hex)..."
            className="input h-32 font-mono text-sm mb-4"
            spellCheck={false}
          />

          {error && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={loading}
            className="btn btn-primary w-full py-4"
          >
            {loading ? 'Importing...' : 'Import Identity'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="w-24 h-24 mb-8 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span className="text-5xl">🌐</span>
        </div>

        <h1 className="text-3xl font-bold mb-2 text-center">GNS Browser</h1>
        <p className="text-slate-400 text-center mb-12">
          Your gateway to the Identity Web
        </p>

        {/* Features */}
        <div className="w-full max-w-sm space-y-4 mb-12">
          <Feature
            icon={<KeyRound className="w-5 h-5" />}
            title="Own Your Identity"
            description="One cryptographic key for everything"
          />
          <Feature
            icon={<MapPin className="w-5 h-5" />}
            title="Prove Your Humanity"
            description="No biometrics, just your trajectory"
          />
          <Feature
            icon={<MessageCircle className="w-5 h-5" />}
            title="Encrypted Messaging"
            description="End-to-end encrypted by default"
          />
          <Feature
            icon={<Shield className="w-5 h-5" />}
            title="No Passwords"
            description="Your device is your authenticator"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-6 space-y-3">
        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-2">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="btn btn-primary w-full py-4 flex items-center justify-center gap-2"
        >
          {loading ? (
            'Creating...'
          ) : (
            <>
              Create New Identity
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <button
          onClick={() => setStep('import')}
          disabled={loading}
          className="btn btn-secondary w-full py-4 flex items-center justify-center gap-2"
        >
          <Import className="w-5 h-5" />
          Import Existing Identity
        </button>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-slate-400 text-sm">{description}</p>
      </div>
    </div>
  );
}
