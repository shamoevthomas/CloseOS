
export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    try {
        const url = new URL(req.url);
        const targetPath = url.searchParams.get('url');

        if (!targetPath) {
            return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                }
            });
        }

        // Construct target URL
        const targetUrl = `https://api.cal.com${targetPath}`;

        // Forward headers (especially Authorization)
        const headers = new Headers();
        const authHeader = req.headers.get('Authorization');

        console.log(`[Proxy] Target: ${targetUrl}`);
        console.log(`[Proxy] Auth Header Present: ${!!authHeader}`); // Debug log

        if (authHeader) {
            console.log(`[Proxy] Auth Header Length: ${authHeader.length}`);
            console.log(`[Proxy] Auth Header Preview: ${authHeader.substring(0, 15)}...`);
            headers.set('Authorization', authHeader);
        } else {
            console.warn(`[Proxy] Missing Authorization Header!`);
        }

        headers.set('Content-Type', 'application/json');

        const options: RequestInit = {
            method: req.method,
            headers: headers,
        };

        // Forward body for non-GET/HEAD requests
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            const bodyText = await req.text();
            if (bodyText) {
                options.body = bodyText;
                console.log(`[Proxy] Body included (${bodyText.length} chars)`);
            }
        }

        const response = await fetch(targetUrl, options);

        console.log(`[Proxy] Upstream Status: ${response.status}`);

        // Handling response
        const responseBody = await response.text();

        if (!response.ok) {
            console.log(`[Proxy] Upstream Error Body: ${responseBody.slice(0, 500)}`);
        }

        return new Response(responseBody, {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // Allow CORS for frontend
            },
        });

    } catch (error: any) {
        console.error('Cal.com Proxy Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
}
