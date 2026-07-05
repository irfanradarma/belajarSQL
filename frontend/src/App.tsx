import "./lib/store/theme"; // module import applies the persisted/system theme to <html> on load
import "./lib/store/connection"; // wires the 401 -> "session expired" handler
import { AppShell } from "./components/Layout/AppShell";
import { ConnectPage } from "./components/Connect/ConnectPage";
import { useConnectionStore } from "./lib/store/connection";

function App() {
  const status = useConnectionStore((s) => s.status);
  const isConnected = status === "connected";

  return isConnected ? <AppShell /> : <ConnectPage />;
}

export default App;
