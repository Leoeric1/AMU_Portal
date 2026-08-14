const ROUTES = [
  {
    prefix: "/exhibition",
    envKey: "EXHIBITION_ORIGIN",
    fallbackOrigin: "https://amu-exhibition.pages.dev",
  },
  {
    prefix: "/culture",
    envKey: "CULTURE_ORIGIN",
    fallbackOrigin: "https://magazinelite.pages.dev",
  },
  {
    prefix: "/factory",
    envKey: "FACTORY_ORIGIN",
    fallbackOrigin: "",
  },
  {
    prefix: "/events",
    envKey: "EVENTS_ORIGIN",
    fallbackOrigin: "",
  },
];

function matchRoute(pathname) {
  return ROUTES.find(
    (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`),
  );
}

function normalizeOrigin(value) {
  if (!value) return "";
  return value.trim().replace(/\/$/, "");
}

function prefixRootPath(value, prefix) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return value;
  if (value === prefix || value.startsWith(`${prefix}/`)) return value;
  return `${prefix}${value}`;
}

function rewriteSrcset(value, prefix) {
  if (!value) return value;
  return value
    .split(",")
    .map((part) => {
      const bits = part.trim().split(/\s+/);
      bits[0] = prefixRootPath(bits[0], prefix);
      return bits.join(" ");
    })
    .join(", ");
}

class AttributeRewriter {
  constructor(prefix) {
    this.prefix = prefix;
  }

  element(element) {
    for (const attr of ["href", "src", "action", "poster"]) {
      const value = element.getAttribute(attr);
      if (value) element.setAttribute(attr, prefixRootPath(value, this.prefix));
    }

    const srcset = element.getAttribute("srcset");
    if (srcset) element.setAttribute("srcset", rewriteSrcset(srcset, this.prefix));
  }
}

function rewriteLocation(location, requestUrl, upstreamOrigin, prefix) {
  if (!location) return location;

  try {
    const resolved = new URL(location, upstreamOrigin);
    const upstream = new URL(upstreamOrigin);

    if (resolved.origin !== upstream.origin) return location;

    const target = new URL(requestUrl.origin);
    target.pathname = `${prefix}${resolved.pathname}`.replace(/\/{2,}/g, "/");
    target.search = resolved.search;
    target.hash = resolved.hash;
    return target.toString();
  } catch {
    return location;
  }
}

function unavailablePage(route, envKey) {
  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>内容暂未接入</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f6f9;color:#0c2741;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}.box{width:min(560px,calc(100% - 40px));padding:34px;border:1px solid #dce6ee;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(31,70,98,.08)}h1{margin:0 0 12px;font-size:26px}p{line-height:1.7;color:#6d7b88}code{padding:3px 7px;border-radius:7px;background:#edf4f8;color:#155b96}a{color:#155b96;text-decoration:none;font-weight:700}
</style>
</head>
<body><div class="box"><h1>该内容入口已预留</h1><p><code>${route}</code> 的路由框架已经建立，但源站尚未配置。</p><p>在 Cloudflare Pages 环境变量中设置 <code>${envKey}</code> 后即可启用。</p><p><a href="/">← 返回数字内容中心</a></p></div></body>
</html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store",
      },
    },
  );
}

export async function onRequest({ request, env, next }) {
  const requestUrl = new URL(request.url);
  const route = matchRoute(requestUrl.pathname);

  if (!route) return next();

  if (requestUrl.pathname === route.prefix) {
    requestUrl.pathname = `${route.prefix}/`;
    return Response.redirect(requestUrl.toString(), 308);
  }

  const upstreamOrigin = normalizeOrigin(env[route.envKey] || route.fallbackOrigin);
  if (!upstreamOrigin) return unavailablePage(route.prefix, route.envKey);

  const upstreamBase = new URL(upstreamOrigin);
  if (upstreamBase.host === requestUrl.host) {
    return new Response("Invalid upstream configuration: origin points to the portal itself.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=UTF-8" },
    });
  }

  const upstreamPath = requestUrl.pathname.slice(route.prefix.length) || "/";
  const upstreamUrl = new URL(upstreamPath, `${upstreamOrigin}/`);
  upstreamUrl.search = requestUrl.search;

  const upstreamRequest = new Request(upstreamUrl.toString(), request);
  const upstreamResponse = await fetch(upstreamRequest);
  const contentType = upstreamResponse.headers.get("content-type") || "";

  const headers = new Headers(upstreamResponse.headers);
  const location = headers.get("location");
  if (location) {
    headers.set(
      "location",
      rewriteLocation(location, requestUrl, upstreamOrigin, route.prefix),
    );
  }

  if (contentType.includes("text/html")) {
    const response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });

    return new HTMLRewriter()
      .on("[href]", new AttributeRewriter(route.prefix))
      .on("[src]", new AttributeRewriter(route.prefix))
      .on("[action]", new AttributeRewriter(route.prefix))
      .on("[poster]", new AttributeRewriter(route.prefix))
      .on("[srcset]", new AttributeRewriter(route.prefix))
      .transform(response);
  }

  if (contentType.includes("text/css")) {
    const css = await upstreamResponse.text();
    const rewritten = css.replace(
      /url\((['"]?)\/(?!\/)/g,
      `url($1${route.prefix}/`,
    );
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(rewritten, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
