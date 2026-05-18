import React from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';

export default function SetupPage() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const isMissing = !supabaseUrl || !supabaseKey;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">Setup Required</h1>

        <p className="text-gray-600 mb-6">
          Welcome to Restafy! To get started, you need to configure your Supabase project.
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-bold text-red-900 mb-2">Missing Environment Variables:</h3>
          <ul className="text-sm text-red-800 space-y-1">
            {!supabaseUrl && <li>❌ VITE_SUPABASE_URL</li>}
            {!supabaseKey && <li>❌ VITE_SUPABASE_ANON_KEY</li>}
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-bold text-blue-900 mb-3">Setup Instructions:</h3>
          <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
            <li>Create a Supabase project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">supabase.com</a></li>
            <li>Copy your Project URL and Anon Key</li>
            <li>Add to your <code className="bg-blue-100 px-2 py-1 rounded text-blue-900">.env</code> file:
              <pre className="bg-blue-100 p-2 rounded mt-2 text-xs overflow-auto">
{`VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key`}
              </pre>
            </li>
            <li>Restart your development server</li>
          </ol>
        </div>

        <a
          href="https://supabase.com/docs/guides/getting-started/quickstarts/react"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors"
        >
          View Setup Guide
          <ExternalLink className="w-4 h-4" />
        </a>

        <p className="text-xs text-gray-500 mt-6">
          For local development, check the .env.example file in your project root.
        </p>
      </div>
    </div>
  );
}
