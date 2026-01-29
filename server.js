/**
 * Custom server to handle CORS preflight (OPTIONS) for /api/auth/* in Node.js.
 * Fixes 405 on OPTIONS when Next.js catch-all doesn't receive the request.
 * See: https://github.com/better-auth/better-auth/issues/4052
 */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname || "";

    if (req.method === "OPTIONS" && pathname.startsWith("/api/auth")) {
      const origin = req.headers.origin || "*";
      const requestedMethod = req.headers["access-control-request-method"];
      const requestedHeaders = req.headers["access-control-request-headers"];

      res.writeHead(204, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": requestedMethod || "GET, POST, PUT, DELETE, OPTIONS, PATCH",
        "Access-Control-Allow-Headers": requestedHeaders || "Content-Type, Authorization, Cookie, X-Requested-With, Accept, Origin",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    handle(req, res, parsedUrl);
  })
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
