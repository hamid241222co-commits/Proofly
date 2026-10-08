import Link from 'next/link';
import { Shield, BookOpen, AlertTriangle } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative isolate px-6 pt-14 lg:px-8">
      <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Explainable Academic Integrity
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Proofly goes beyond simple AI detection percentages. Our evidence engine provides transparent, 
          explainable reports combining source similarity, linguistic fingerprints, and AI writing signals.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="/login"
            className="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Get started
          </Link>
          <Link href="/signup" className="text-sm font-semibold leading-6 text-gray-900">
            Create an account <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
