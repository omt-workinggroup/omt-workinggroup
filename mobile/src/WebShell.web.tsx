import { createElement, forwardRef, useImperativeHandle, useRef } from 'react';
import type { ShellHandle, ShellProps } from './shell-types';

// Browser preview only (npx expo start --web): an iframe stands in for the native WebView.
// The live site refuses to be framed, so point EXPO_PUBLIC_SITE_URL at a local copy when previewing.
export const WebShell = forwardRef<ShellHandle, ShellProps>(function WebShell(props, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  useImperativeHandle(ref, () => ({
    goBack: () => frame.current?.contentWindow?.history.back(),
    reload: () => frame.current?.contentWindow?.location.reload(),
  }));
  return createElement('iframe', {
    ref: frame,
    src: props.uri,
    title: 'OMT Resources',
    style: { flex: 1, width: '100%', height: '100%', border: 0 },
    onLoad: () => {
      // The company homepage is not part of the app (the native app does this in onShouldStartLoadWithRequest).
      try {
        const path = frame.current?.contentWindow?.location.pathname;
        if (path === '/' || path === '/index.html') { props.onGoHome(); return; }
      } catch {
        // Cross-origin page: leave it.
      }
      props.onProgress(1);
      props.onLoaded();
      try {
        const doc = frame.current?.contentDocument;
        if (doc?.body) props.onPageColour(getComputedStyle(doc.body).backgroundColor);
      } catch {
        // Cross-origin page: keep the default colour.
      }
    },
  });
});
