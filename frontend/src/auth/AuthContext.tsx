import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserData, LoginResponse } from '@backend/shared/types';
import {API_BASE_URL} from "@backend/shared/API_BASE_URL.ts";

interface AuthContextType {
    user: UserData | null;
    isAuthenticated: boolean;
    isGuest: boolean;
    login: (username: string, password: string) => Promise<LoginResponse>;
    loginAsGuest: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'paletki_user_session';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserData | null>(() => {
        try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    useEffect(() => {
        if (user) {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(AUTH_STORAGE_KEY);
        }
    }, [user]);

    const login = async (username: string, password: string): Promise<LoginResponse> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ login: username, password }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                return {
                    status: false,
                    message: errData?.message || 'backend.auth.AUTH_CONNECTION_ERROR',
                };
            }

            const resData: LoginResponse = await response.json();

            if (resData.status && resData.data) {
                setUser(resData.data);
            }

            return resData;
        } catch (err) {
            return {
                status: false,
                message: 'backend.auth.AUTH_UNKNOWN',
            };
        }
    };

    const loginAsGuest = () => {
        setUser({
            FullName: 'Guest',
            department: '',
            title: 'Guest',
            username: 'guest',
        });
    };

    const logout = () => {
        setUser(null);
    };

    const isGuest = user?.username === 'guest';

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isGuest,
                login,
                loginAsGuest,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
