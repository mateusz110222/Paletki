import React from 'react';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider, useAuth} from './auth/AuthContext.tsx';
import {LanguageProvider} from './i18n/LanguageContext.tsx';
import {LoginView} from './views/LoginView.tsx';
import {AppRoutes} from './routes/AppRoutes.tsx';

export default function App() {
    return (
        <LanguageProvider>
            <AuthProvider>
                <BrowserRouter>
                    <AppRoot/>
                </BrowserRouter>
            </AuthProvider>
        </LanguageProvider>
    );
}

function AppRoot() {
    const {isAuthenticated} = useAuth();

    if (!isAuthenticated) {
        return <LoginView/>;
    }

    return <AppRoutes/>;
}