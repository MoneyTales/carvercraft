import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// StrictMode intentionally off: its simulated join/leave/join cycle on
// useRoom forces a WebRTC renegotiation race mid-session (engine issue,
// tracked in tasks/lessons.md). Games typically run without it anyway.
createRoot(document.getElementById("root")!).render(<App />);
