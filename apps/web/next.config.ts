import type { NextConfig } from "next";
import { isPublicSupabaseKey } from "./src/lib/supabase/public-key";

// Stop BEFORE compilation can inline an accidentally privileged public variable.
if (!isPublicSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')) {
  throw new Error('CRM configuration rejected: the public Supabase key must be publishable or anon. No build was started.');
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'echarts', 'jspdf'],
  },
};

export default nextConfig;
