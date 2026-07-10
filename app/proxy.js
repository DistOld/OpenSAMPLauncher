// api/proxy.js
export const config = {
  runtime: 'edge', // Запуск в среде Edge для поддержки стриминга ответов
};

export default async function handler(request) {
  // Набор CORS-заголовков для локального браузера
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  };

  // Перехватываем OPTIONS-запрос preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const url = new URL(request.url);
  // Корректируем путь, отсекая префикс функции Vercel
  const targetPath = url.pathname.replace('/api/proxy', '');
  const targetUrl = `https://openrouter.ai${targetPath || '/api/v1/chat/completions'}${url.search}`;

  // Копируем только безопасные заголовки
  const cleanHeaders = new Headers();
  const headersToForward = ['authorization', 'content-type', 'http-referer', 'x-title'];
  headersToForward.forEach(header => {
    const val = request.headers.get(header);
    if (val) {
      cleanHeaders.set(header, val);
    }
  });

  const hasBody = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  let requestBody = null;
  if (hasBody) {
    requestBody = await request.text();
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: cleanHeaders,
      body: requestBody,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
}
