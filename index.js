export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle API routes
    if (pathname === '/api/subscribe' && request.method === 'POST') {
      return handleSubscribe(request, env);
    }

    if (pathname === '/api/subscribe' && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Handle contributor submission API route
    if (pathname === '/api/contribute' && request.method === 'POST') {
      return handleContribute(request, env);
    }

    if (pathname === '/api/contribute' && request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Serve static assets from the Asset Catalog
    return env.ASSETS.fetch(request);
  }
};

async function handleSubscribe(request, env) {
  try {
    const { email, source } = await request.json();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Get Supabase credentials from environment variables
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Check if email already exists
    const checkResponse = await fetch(`${supabaseUrl}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id`, {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    const existing = await checkResponse.json();

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Email already subscribed' }),
        { 
          status: 409, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Insert new subscriber
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/subscribers`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email: email.toLowerCase(),
        source: source || 'updates-page'
      })
    });

    if (!insertResponse.ok) {
      const error = await insertResponse.text();
      console.error('Supabase insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save subscription' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Subscription saved successfully' 
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
}

async function handleContribute(request, env) {
  try {
    const { fullName, email, role, topic, submissionType, portfolioLink, pitch } = await request.json();

    // Validate required fields
    if (!fullName || !fullName.trim()) {
      return new Response(
        JSON.stringify({ error: 'Full name is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    if (!topic || !topic.trim()) {
      return new Response(
        JSON.stringify({ error: 'Topic is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    if (!submissionType) {
      return new Response(
        JSON.stringify({ error: 'Submission type is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    if (!pitch || !pitch.trim() || pitch.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Message must be at least 10 characters' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Validate URL if provided
    if (portfolioLink && portfolioLink.trim()) {
      try {
        const url = new URL(portfolioLink);
        if (!url.protocol.startsWith('http')) {
          throw new Error('Invalid protocol');
        }
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid portfolio URL' }),
          { 
            status: 400, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            } 
          }
        );
      }
    }

    // Get Supabase credentials from environment variables
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Insert contributor application
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/contributor_applications`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.toLowerCase().trim(),
        role_background: role ? role.trim() : null,
        topic_area: topic.trim(),
        submission_type: submissionType,
        portfolio_link: portfolioLink && portfolioLink.trim() ? portfolioLink.trim() : null,
        message: pitch.trim(),
        created_at: new Date().toISOString()
      })
    });

    if (!insertResponse.ok) {
      const error = await insertResponse.text();
      console.error('Supabase insert error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save submission' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Application submitted successfully' 
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error) {
    console.error('Contribute function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
}
