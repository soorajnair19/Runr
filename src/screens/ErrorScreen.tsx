interface ErrorScreenProps {
  message: string
  onRetry: () => void
}

export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return (
    <section className="screen error-screen">
      <h1 className="brand brand-sm">Runr</h1>
      <p className="error-message" role="alert">
        {message}
      </p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={onRetry}
        aria-label="Try again"
      >
        TRY AGAIN
      </button>
    </section>
  )
}
