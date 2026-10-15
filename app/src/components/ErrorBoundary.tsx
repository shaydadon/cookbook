import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg p-6 text-center text-ink">
        <p className="text-xl font-bold">משהו השתבש</p>
        <button type="button" onClick={() => location.reload()}
          className="pressable min-h-11 rounded-xl bg-accent px-6 font-semibold text-on-accent">
          רענון
        </button>
      </main>
    );
  }
}
