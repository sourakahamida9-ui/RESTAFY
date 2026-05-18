import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  level?: 'app' | 'section' | 'page';
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

const isDevelopment = import.meta.env.DEV;

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: '',
    };
  }

  static getDerivedStateFromError(error: unknown): State {
    const err =
      error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Erreur inattendue');
    return {
      hasError: true,
      error: err,
      errorInfo: err.message,
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo) {
    const err = error instanceof Error ? error : new Error(String(error));
    const level = this.props.level || 'app';
    const isDev = isDevelopment;

    // Logger en développement
    if (isDev) {
      console.error(`[ErrorBoundary:${level}] Error caught:`, err);
      console.error('[ErrorBoundary] Info:', errorInfo);
    }

    // Extraire le message le plus informatif possible
    let userMessage = err.message || 'Une erreur s\'est produite';
    if (userMessage.includes('infinite recursion')) {
      userMessage = 'Erreur système: données corrompues';
    } else if (userMessage.includes('Invalid URL')) {
      userMessage = 'Erreur configuration: contactez l\'administrateur';
    } else if (userMessage.includes('timeout')) {
      userMessage = 'La connexion a pris trop de temps';
    }

    this.setState({
      hasError: true,
      error: err,
      errorInfo: isDev ? errorInfo.componentStack : userMessage,
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: '',
    });
    // Recharger la page si erreur critique (niveau app)
    if (this.props.level === 'app') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const level = this.props.level || 'app';
      const isDev = isDevelopment;

      if (this.props.fallback && level !== 'app') {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: level === 'app' ? '100vh' : '200px',
            padding: '2rem',
            backgroundColor: '#FFF5F0',
            borderRadius: '1rem',
            border: '1px solid #FFB8A0',
          }}
        >
          <AlertCircle style={{ width: '3rem', height: '3rem', color: '#F27D26', marginBottom: '1rem' }} />
          
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1A1A1A', marginBottom: '0.5rem' }}>
            Erreur
          </h2>
          
          <p style={{ fontSize: '0.875rem', color: '#666', textAlign: 'center', marginBottom: '1rem', maxWidth: '400px' }}>
            {isDev
              ? this.state.error?.message || 'Erreur inconnue'
              : 'Une erreur s\'est produite. Nos équipes ont été notifiées.'}
          </p>

          {isDev && this.state.errorInfo && (
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem',
                maxHeight: '200px',
                overflowY: 'auto',
                width: '100%',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#333',
              }}
            >
              {this.state.errorInfo}
            </div>
          )}

          <button
            onClick={this.resetError}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#F27D26',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.75rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E06B1A'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F27D26'}
          >
            <RefreshCw style={{ width: '1rem', height: '1rem' }} />
            {level === 'app' ? 'Recharger' : 'Réessayer'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
