import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './AuthContext'
import { LanguageProvider } from './i18n'
import { PlantTypesProvider } from './PlantTypesContext'
import { MapSettingsProvider } from './MapSettingsContext'
import { PwaProvider } from './PwaContext'
import { registerServiceWorker } from './pwa'
import './styles.css'

registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <PlantTypesProvider>
          <MapSettingsProvider>
            <PwaProvider>
              <App />
            </PwaProvider>
          </MapSettingsProvider>
        </PlantTypesProvider>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>,
)
