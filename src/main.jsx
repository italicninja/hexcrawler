import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Temporarily disable StrictMode to debug infinite loop
// StrictMode causes double-rendering which can exacerbate issues
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
