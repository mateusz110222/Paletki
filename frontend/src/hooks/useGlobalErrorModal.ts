import { useState, useCallback } from 'react';

interface GlobalErrorModalState {
  isOpen: boolean;
  title: string;
  message: string;
}

export function useGlobalErrorModal() {
  const [errorModalState, setErrorModalState] = useState<GlobalErrorModalState>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showGlobalError = useCallback((title: string, message: string) => {
    setErrorModalState({
      isOpen: true,
      title,
      message,
    });
  }, []);

  const hideGlobalError = useCallback(() => {
    setErrorModalState((prevState) => ({
      ...prevState,
      isOpen: false,
    }));
  }, []);

  return {
    errorModalState,
    showGlobalError,
    hideGlobalError,
  };
}
