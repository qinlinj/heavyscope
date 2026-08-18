import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ErrorState";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("HeavyScope render error", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="dark min-h-svh bg-background text-foreground">
          <div className="relative mx-auto flex min-h-svh max-w-6xl flex-col px-4 py-5 sm:px-6">
            <ErrorState
              titleKey="common.renderErrorTitle"
              bodyKey="common.renderErrorBody"
              message={this.state.error.message}
            />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
