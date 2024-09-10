import { handleRequest } from "./events/fetchHandler";
import { handleScheduled } from "./events/scheduleHandler";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

addEventListener("scheduled", (event) => {
  event.waitUntil(handleScheduled(event));
});
