import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './index.css'
import './animations.css'

try {
  const saved = localStorage.getItem('hireflow-theme');
  document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
} catch (e) {
  document.documentElement.setAttribute('data-theme', 'light');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
