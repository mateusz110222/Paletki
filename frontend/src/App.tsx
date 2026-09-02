import React from 'react';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider} from './auth/AuthContext.tsx';
import {LanguageProvider} from './i18n/LanguageContext.tsx';
import {AppRoutes} from './routes/AppRoutes.tsx';

export default function App() {
    return (
        <LanguageProvider>
            <AuthProvider>
                <BrowserRouter>
                    <AppRoutes/>
                </BrowserRouter>
            </AuthProvider>
        </LanguageProvider>
    );
}
