'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { Provider } from 'react-redux';
import { store } from '@/lib/store';
import { Toaster, toast } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Provider store={store}>
          {children}
          <div onClick={() => toast.dismiss()}>
            <Toaster
              position="top-right"
              toastOptions={{
                success: {
                  duration: 3000,        // success: auto-dismiss after 3s
                },
                error: {
                  duration: Infinity,    // error: stays forever until clicked
                },
                style: {
                  cursor: 'pointer',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                  padding: '12px 16px',
                },
              }}
            />
          </div>
        </Provider>
      </body>
    </html>
  );
}