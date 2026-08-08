import { Hono } from "hono";
import { } from "@repo/core";
const app = new Hono();

app.get("/", (c) => c.text("Hello World"));

export default app;