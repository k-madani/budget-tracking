import toast from 'react-hot-toast';

export const handleApiError = (error: any, customMessage?: string) => {
  console.error('API Error:', error);

  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        if (typeof data === 'object') {
          const errors = Object.entries(data)
            .map(([key, value]) => {
              const message = Array.isArray(value) ? value.join(', ') : value;
              return `${key}: ${message}`;
            })
            .join('\n');
          toast.error(errors || customMessage || 'Invalid request');
        } else {
          toast.error(customMessage || data.detail || 'Invalid request');
        }
        break;

      case 401:
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        break;

      case 403:
        toast.error('You don\'t have permission to perform this action');
        break;

      case 404:
        toast.error(customMessage || 'Resource not found');
        break;

      case 500:
        toast.error('Server error. Please try again later.');
        break;

      default:
        toast.error(customMessage || 'Something went wrong. Please try again.');
    }
  } else if (error.request) {
    toast.error('Network error. Please check your connection.');
  } else {
    toast.error(customMessage || 'An unexpected error occurred');
  }
};

export const showSuccess = (message: string) => {
  toast.success(message);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showInfo = (message: string) => {
  toast(message, {
    icon: 'ℹ️',
  });
};