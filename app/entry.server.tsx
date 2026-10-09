import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter, type EntryContext } from "react-router";
import { renderToPipeableStream } from "react-dom/server";
export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    let shell = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={context} url={request.url} />,
      {
        onShellReady() {
          shell = true;
          const body = new PassThrough();
          headers.set("Content-Type", "text/html");
          headers.set("X-Content-Type-Options", "nosniff");
          headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
          headers.set("X-Frame-Options", "DENY");
          headers.set("Cache-Control", "no-store");
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              status,
              headers,
            }),
          );
          pipe(body);
        },
        onShellError: reject,
        onError(error) {
          status = 500;
          if (shell) console.error(error);
        },
      },
    );
    setTimeout(abort, 10000).unref();
  });
}
