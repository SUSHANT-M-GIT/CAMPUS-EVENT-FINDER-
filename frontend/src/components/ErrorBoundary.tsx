import { Component } from "react";
import type { ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
          <h2 style={{ color: "#dc2626" }}>Something went wrong</h2>
          <p style={{ color: "#64748b", marginBottom: "16px" }}>{this.state.error.message}</p>
          <button
            style={{ padding: "10px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
            onClick={() => { this.setState({ error: null }); window.location.href = "/login"; }}
          >
            Back to Login
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
