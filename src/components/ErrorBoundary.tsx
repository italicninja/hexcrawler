// @ts-nocheck
import { Component } from 'react';
import logger from '../utils/logger';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, errorInfo) {
    logger.general.error('Error Boundary caught an error:', { error, errorInfo });
    this.setState({ error, errorInfo });
  }
  handleReset = () => this.setState({ hasError: false, error: null, errorInfo: null });
  handleReload = () => window.location.reload();
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'#1a1a1a',color:'#e0e0e0',padding:'20px',textAlign:'center' }}>
          <div style={{ maxWidth:'600px',background:'#2a2a2a',border:'2px solid #e74c3c',borderRadius:'8px',padding:'30px',boxShadow:'0 4px 12px rgba(0,0,0,0.5)' }}>
            <h1 style={{ color:'#e74c3c',marginTop:0 }}>⚠️ Something went wrong</h1>
            <p style={{ fontSize:'1.1em',marginBottom:'20px' }}>The application encountered an unexpected error.</p>
            {this.state.error && (
              <details style={{ background:'#1a1a1a',border:'1px solid #555',borderRadius:'4px',padding:'15px',marginBottom:'20px',textAlign:'left' }}>
                <summary style={{ cursor:'pointer',color:'#f39c12',marginBottom:'10px' }}>Error Details</summary>
                <div style={{ fontSize:'0.9em',color:'#aaa' }}>
                  <p style={{ color:'#e74c3c' }}><strong>Error:</strong> {this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre style={{ background:'#0d0d0d',padding:'10px',borderRadius:'4px',overflow:'auto',fontSize:'0.8em',maxHeight:'200px' }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
            <div style={{ display:'flex',gap:'10px',justifyContent:'center' }}>
              <button onClick={this.handleReset} style={{ background:'#3498db',border:'2px solid #2980b9',color:'white',padding:'12px 24px',borderRadius:'4px',cursor:'pointer',fontSize:'1em',fontWeight:'bold' }}>Try Again</button>
              <button onClick={this.handleReload} style={{ background:'#e67e22',border:'2px solid #d35400',color:'white',padding:'12px 24px',borderRadius:'4px',cursor:'pointer',fontSize:'1em',fontWeight:'bold' }}>Reload App</button>
            </div>
            <p style={{ fontSize:'0.9em',color:'#888',marginTop:'20px',marginBottom:0 }}>If this error persists, try clearing your browser cache or localStorage.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
