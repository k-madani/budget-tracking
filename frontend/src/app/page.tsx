import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center text-white space-y-6 p-8">
        <h1 className="text-6xl font-bold">Budget Tracker</h1>
        <p className="text-xl">Take control of your finances</p>
        
        <div className="space-x-4 mt-8">
          <Link
            href="/login"
            className="inline-block px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-block px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-600 transition"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}