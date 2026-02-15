
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
        let finalTargetUrl = `https://api.cal.com${targetPath}`;

        // Forward headers (especially Authorization)
        const headers = new Headers();
        const authHeader = req.headers.get('Authorization');

        console.log(`[Proxy] Target Path: ${targetPath}`);
        console.log(`[Proxy] Auth Header Present: ${!!authHeader}`);

        if (authHeader) {
            // console.log(`[Proxy] Auth Header Length: ${authHeader.length}`);
            headers.set('Authorization', authHeader);

            // Fallback: Append access_token query param for V1 endpoints if Bearer token
            // This helps if Cal.com V1 fails to read the header or expects apiKey/access_token param
            if (authHeader.startsWith('Bearer ')) {
                const token = authHeader.split(' ')[1];
                const separator = finalTargetUrl.includes('?') ? '&' : '?';
                finalTargetUrl += `${separator}access_token=${token}`;
                console.log(`[Proxy] Appended access_token to URL fallback`);
            }
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

        console.log(`[Proxy] Fetching: ${finalTargetUrl}`);
        const response = await fetch(finalTargetUrl, options);

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
