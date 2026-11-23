import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    version: '3.0.0',
    company: 'FINLONEXA CRM (Single Company)',
    timestamp: new Date().toISOString(),
  });
}
