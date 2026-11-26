import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    // Enforce payload size limit (max 64KB)
    const rawText = await req.clone().text().catch(() => '');
    if (rawText.length > 65536) {
      return NextResponse.json(
        { success: false, error: 'Request payload exceeds maximum allowed size' },
        { status: 413, headers: corsHeaders }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    let formId: string | null = null;
    let payload: Record<string, any> = {};

    if (contentType.includes('application/json')) {
      const body = await req.json();
      formId = body.form_id || body.formId || req.nextUrl.searchParams.get('form_id');
      payload = body;
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      formId = (formData.get('form_id') as string) || req.nextUrl.searchParams.get('form_id');
      for (const [key, value] of formData.entries()) {
        payload[key] = value;
      }
    } else {
      // Fallback: try search parameters or text
      formId = req.nextUrl.searchParams.get('form_id');
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        // empty
      }
    }

    if (!formId) {
      return NextResponse.json(
        { success: false, error: 'form_id parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Call database via supabase admin client (bypasses RLS for public submission via secure RPC)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('submit_web_to_lead', {
      p_form_id: formId,
      p_payload: payload,
    });

    if (error) {
      console.error('[Web-To-Lead Error]', error);
      const invalidForm = error.code === 'P0002';
      const invalidInput = typeof error.code === 'string' && error.code.startsWith('22');
      return NextResponse.json(
        {
          success: false,
          error: invalidForm ? 'This form is unavailable.'
            : invalidInput ? 'The submission could not be accepted.'
              : 'The submission could not be completed. Please retry.',
        },
        { status: invalidForm ? 404 : invalidInput ? 400 : 503, headers: corsHeaders }
      );
    }

    const result = data as {
      success: boolean;
      return_url?: string | null;
      message?: string;
      description?: string;
      lead_id?: string;
      duplicate_prevented?: boolean;
    };

    // If submitted via browser form and return_url is provided, redirect
    if (result?.return_url && !contentType.includes('application/json')) {
      return NextResponse.redirect(result.return_url, 303);
    }

    // Generic response: do not disclose CRM internal record IDs or duplicate status
    return NextResponse.json(
      {
        success: true,
        message: result?.message || 'Thank you for your submission!',
        description: result?.description || '',
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[Web-To-Lead Exception]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
