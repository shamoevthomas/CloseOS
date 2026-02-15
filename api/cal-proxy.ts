
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
        if (authHeader) {
            headers.set('Authorization', authHeader);
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
            }
        }

        const response = await fetch(targetUrl, options);

        // Handling response
        const responseBody = await response.text();

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
