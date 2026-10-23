/**
 * Vega WebView shell for CareSignal DoorSense TV (`/tv`).
 *
 * Copy into the generated Vega project as `src/App.tsx` after:
 *   vega project generate --template vegaWebview ...
 *   npm install @amazon-devices/webview
 *
 * Set CARESIGNAL_TV_URL to your HTTPS tunnel …/tv (required for VVD / device).
 */
import { WebView } from "@amazon-devices/webview";
import * as React from "react";
import { useRef } from "react";
import { StyleSheet, View } from "react-native";

/** HTTPS only — Vega WebView blocks cleartext by default. */
const TV_URL =
  (typeof process !== "undefined" &&
    process.env?.CARESIGNAL_TV_URL?.trim()) ||
  "https://localhost:3000/tv";

export const App = () => {
  const webRef = useRef(null);

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        style={styles.webview}
        hasTVPreferredFocus={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        source={{ uri: TV_URL }}
        onError={(event) => {
          console.log("CareSignal TV WebView error", event.nativeEvent);
        }}
        onLoad={(event) => {
          console.log("CareSignal TV loaded", event.nativeEvent.url);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
  },
});

export default App;
