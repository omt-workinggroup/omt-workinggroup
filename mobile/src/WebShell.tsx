import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { APP_USER_AGENT, routeFor } from './site';
import type { ShellHandle, ShellProps } from './shell-types';

// After each page loads, tell the app the page's background colour so the status bar area matches it.
const REPORT_COLOUR = `
  (function () {
    function send() {
      var c = getComputedStyle(document.body).backgroundColor;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'colour', value: c }));
    }
    if (document.readyState === 'complete') send(); else window.addEventListener('load', send);
  })();
  true;
`;

export const WebShell = forwardRef<ShellHandle, ShellProps>(function WebShell(props, ref) {
  const view = useRef<WebView<object>>(null);
  useImperativeHandle(ref, () => ({
    goBack: () => view.current?.goBack(),
    reload: () => view.current?.reload(),
  }));

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data?.type === 'colour' && typeof data.value === 'string') props.onPageColour(data.value);
    } catch {
      // Not one of our messages.
    }
  };

  return (
    // WebView<object>: its typings default the extra props to `undefined`, which makes every prop `never`.
    <WebView<object>
      ref={view}
      key={props.uri}
      source={{ uri: props.uri }}
      style={styles.web}
      applicationNameForUserAgent={APP_USER_AGENT}
      injectedJavaScript={REPORT_COLOUR}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(req) => {
        const route = routeFor(req.url);
        if (route.kind === 'load') return true;
        if (route.kind === 'start') props.onGoHome();
        else Linking.openURL(req.url).catch(() => {});
        return false;
      }}
      setSupportMultipleWindows={false}
      onNavigationStateChange={(nav) => props.onCanGoBack(nav.canGoBack)}
      onLoadProgress={({ nativeEvent }) => props.onProgress(nativeEvent.progress)}
      onLoadEnd={props.onLoaded}
      onError={props.onFailed}
      onHttpError={({ nativeEvent }) => { if (nativeEvent.statusCode >= 500) props.onFailed(); }}
      pullToRefreshEnabled
      contentInsetAdjustmentBehavior="never"
      allowsBackForwardNavigationGestures
      allowsInlineMediaPlayback
      domStorageEnabled
      sharedCookiesEnabled
      textZoom={100}
      decelerationRate="normal"
      overScrollMode="never"
    />
  );
});

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: 'transparent' },
});
