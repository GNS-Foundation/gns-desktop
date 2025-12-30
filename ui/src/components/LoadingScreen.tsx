/**
 * Loading Screen Component
 */

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      {/* Logo animation */}
      <div className="w-20 h-20 mb-8 relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse" />
        <div className="absolute inset-2 rounded-full bg-slate-900 flex items-center justify-center">
          <span className="text-3xl">🌐</span>
        </div>
      </div>

      {/* Loading spinner */}
      <div className="w-8 h-8 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4" />

      {/* Message */}
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
