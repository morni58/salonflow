import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center"
          style={{ color: "var(--color-text)" }}
        >
          <div className="text-5xl">😵</div>
          <h2 className="font-serif text-xl font-semibold">Что-то пошло не так</h2>
          <p className="max-w-sm text-sm opacity-50">
            {this.state.error?.message || "Произошла неожиданная ошибка"}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="btn-primary-soft mt-2 rounded-full bg-brand-500 px-8 py-3 text-sm font-semibold text-white shadow-soft"
          >
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
