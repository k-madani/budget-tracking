'use client';

import toast from 'react-hot-toast';

export const showError = (message: string) => {
  toast.error(message, {
    duration: Infinity,  // never auto-dismiss
    style: { cursor: 'pointer' },
  });
};

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
  });
};