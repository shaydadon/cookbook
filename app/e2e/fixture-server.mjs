import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("./fixtures/recipe.html", import.meta.url));
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(5199, "0.0.0.0", () => console.log("fixture server on 5199"));
