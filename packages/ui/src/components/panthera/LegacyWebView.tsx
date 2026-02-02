// ═══════════════════════════════════════════════════════════════════
// PANTHERA v2 — Legacy Web Fallback View
// ═══════════════════════════════════════════════════════════════════
// Location: packages/ui/src/components/panthera/LegacyWebView.tsx
//
// Renders traditional websites with the GNS trust overlay.
// PLATFORM ADAPTIVE:
//   Tauri Desktop → native webview (bypasses X-Frame-Options!)
//   Web Browser   → iframe (with blocked-site detection)
//
// Domain org lookup delegated to legacy-web bridge (with caching).
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, ShieldCheck, Loader2, X, ExternalLink,
  AlertTriangle, Info,
} from 'lucide-react';

// ─── Bridge import ───
// This is the key integration: legacy-web.ts handles platform detection,
// Tauri IPC, domain caching, and iframe blocked-site detection.
import {
  isTauri,
  lookupDomainOrg,
  isIframeBlocked,
  openLegacyUrl,
  closeLegacyWebview,
  listenLegacyNavigation,
  type OrgInfo,
} from '../../lib/legacy-web';

import TrustBadge from './TrustBadge';

// ═══════════════════════════════════════════════════════════════════

interface LegacyWebViewProps {
  url: string;
  domain: string;
  onNavigate: (input: string) => void;
}

export default function LegacyWebView({ url, domain, onNavigate }: LegacyWebViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ─── State ───
  const [orgInfo, setOrgInfo] = useState<OrgInfo | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isNativeWebview, setIsNativeWebview] = useState(false);

  // ─── Platform detection ───
  useEffect(() => {
    const native = isTauri();
    setIsNativeWebview(native);

    if (native) {
      // Open URL in native webview (bypasses all iframe restrictions)
      openLegacyUrl(url).catch(console.error);

      // Listen for navigation events from native webview
      const cleanup = listenLegacyNavigation((state) => {
        // When user clicks a link inside native webview,
        // re-check the new domain for GNS org
        if (state.domain !== domain) {
          lookupDomainOrg(state.domain).then(setOrgInfo);
        }
      });

      return () => {
        cleanup.then(fn => fn?.());
        closeLegacyWebview().catch(() => {});
      };
    } else {
      // Web mode: check if this domain blocks iframes
      if (isIframeBlocked(domain)) {
        setIframeError(true);
      }
    }
  }, [url, domain]);

  // ─── Domain org lookup (via bridge — cached!) ───
  useEffect(() => {
    if (!domain) return;
    setOrgLoading(true);
    setOrgInfo(null);

    lookupDomainOrg(domain).then((org) => {
      setOrgInfo(org);
      setOrgLoading(false);
    });
  }, [domain]);

  // ─── Cleanup native webview on unmount ───
  useEffect(() => {
    return () => {
      if (isNativeWebview) {
        closeLegacyWebview().catch(() => {});
      }
    };
  }, [isNativeWebview]);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div className="relative flex-1 flex flex-col h-full">
      {/* ─── GNS Trust Overlay Bar ─── */}
      {showOverlay && (
        <div className={`flex items-center gap-3 px-4 py-2 text-xs border-b transition-all ${
          orgInfo
            ? 'bg-cyan-50 border-cyan-200'
            : orgLoading
            ? 'bg-gray-50 border-gray-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          {orgLoading ? (
            <>
              <Loader2 size={14} className="text-gray-400 animate-spin" />
              <span className="text-gray-500">
                Checking GNS verification for {domain}…
              </span>
            </>
          ) : orgInfo ? (
            <>
              <ShieldCheck size={16} className="text-cyan-600" />
              <span className="text-cyan-800 font-semibold">
                GNS Verified: @{orgInfo.namespace}
              </span>
              <span className="text-cyan-600">·</span>
              <span className="text-gray-600">
                {orgInfo.displayName || orgInfo.namespace}
              </span>
              {orgInfo.tier && (
                <>
                  <span className="text-cyan-600">·</span>
                  <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded text-[10px] font-medium uppercase">
                    {orgInfo.tier}
                  </span>
                </>
              )}
              {orgInfo.matchedVia === 'parent-domain' && (
                <span className="text-gray-400 text-[10px]">
                  (via {orgInfo.domain})
                </span>
              )}
              <button
                onClick={() => onNavigate(`@${orgInfo.namespace}`)}
                className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full font-medium transition-colors"
              >
                View gSite <ExternalLink size={11} />
              </button>
            </>
          ) : (
            <>
              <Shield size={14} className="text-gray-400" />
              <span className="text-gray-500">
                {domain} — No GNS identity registered
              </span>
              <span className="text-gray-400 ml-auto">Legacy Web</span>
            </>
          )}

          <button
            onClick={() => setShowOverlay(false)}
            className="p-0.5 hover:bg-gray-200 rounded ml-1"
          >
            <X size={12} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* Collapsed overlay → floating badge */}
      {!showOverlay && orgInfo && (
        <button
          onClick={() => setShowOverlay(true)}
          className="absolute top-2 right-2 z-20 flex items-center gap-1 px-2 py-1 bg-cyan-500 text-white rounded-full text-xs font-medium shadow-lg hover:bg-cyan-600 transition-colors"
        >
          <ShieldCheck size={12} /> GNS Verified
        </button>
      )}

      {/* ─── Content Area ─── */}
      {isNativeWebview ? (
        // TAURI: Native webview renders in a separate window managed by Rust.
        // This area shows a status message. In production, the Tauri webview
        // is docked as a child webview within the main window.
        <div className="flex-1 flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
          <div className="text-center">
            <Globe size={32} className="mx-auto mb-2 text-gray-300" />
            <p>Rendering in native webview</p>
            <p className="text-xs text-gray-300 mt-1">{url}</p>
          </div>
        </div>
      ) : iframeError ? (
        // WEB: Iframe blocked by X-Frame-Options
        <IframeBlockedFallback
          url={url}
          domain={domain}
          orgInfo={orgInfo}
          onNavigate={onNavigate}
        />
      ) : (
        // WEB: Standard iframe rendering
        <iframe
          ref={iframeRef}
          src={url}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          onError={() => setIframeError(true)}
          onLoad={() => {
            // If iframe loaded but shows nothing after timeout,
            // the site likely blocks embedding silently
            setTimeout(() => {
              try {
                const frame = iframeRef.current;
                if (frame && !frame.contentDocument?.body?.children?.length) {
                  setIframeError(true);
                }
              } catch {
                // Cross-origin — expected, iframe is working
              }
            }, 3000);
          }}
          title={`Legacy web: ${domain}`}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// Sub-component: Iframe Blocked Fallback
// ═══════════════════════════════════════════════════════════════════
// Shown when a website blocks iframe embedding (X-Frame-Options).
// Provides: Open in new tab, View gSite (if org verified),
// and educational card explaining Document Web vs Identity Web.

function IframeBlockedFallback({
  url,
  domain,
  orgInfo,
  onNavigate,
}: {
  url: string;
  domain: string;
  orgInfo: OrgInfo | null;
  onNavigate: (input: string) => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16 bg-gray-50">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <AlertTriangle size={32} className="text-gray-400" />
      </div>

      <h2 className="text-lg font-semibold text-gray-700 mb-2">
        Cannot embed this page
      </h2>
      <p className="text-sm text-gray-500 max-w-md mb-6">
        <strong>{domain}</strong> prevents embedding in other applications.
        This is a security feature of the traditional web — one that the
        Identity Web solves natively.
      </p>

      <div className="flex items-center gap-3">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-sm font-medium transition-colors"
        >
          <ExternalLink size={15} /> Open in new tab
        </a>
        {orgInfo && (
          <button
            onClick={() => onNavigate(`@${orgInfo.namespace}`)}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <ShieldCheck size={15} /> View @{orgInfo.namespace} gSite
          </button>
        )}
      </div>

      {/* Educational nudge: why this happens */}
      <div className="mt-8 p-4 bg-cyan-50 rounded-xl max-w-md text-left">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-cyan-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-cyan-800 mb-1">
              Why this happens
            </div>
            <p className="text-xs text-cyan-700 leading-relaxed">
              Traditional websites use{' '}
              <code className="bg-cyan-100 px-1 rounded text-[10px]">
                X-Frame-Options
              </code>{' '}
              to prevent embedding. In the Identity Web, gSites render natively
              in PANTHERA with full cryptographic verification — no embedding
              restrictions needed.
            </p>
          </div>
        </div>
      </div>

      {/* Platform hint */}
      {!isTauri() && (
        <p className="mt-4 text-[10px] text-gray-300">
          💡 The PANTHERA desktop app renders all websites natively, bypassing
          this limitation.
        </p>
      )}
    </div>
  );
}

// Need Globe icon for native webview placeholder
import { Globe } from 'lucide-react';
