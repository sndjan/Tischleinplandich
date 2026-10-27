// Caches only Next.js build assets (content-hashed, so never stale).
// Pages and Supabase requests always go to the network so data and auth stay fresh.
// Also receives content shared into the app (see share_target in the manifest).
const CACHE_NAME = "static-v1";
const SHARE_CACHE_NAME = "share-target-v1";
const KEPT_CACHES = [CACHE_NAME, SHARE_CACHE_NAME];

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !KEPT_CACHES.includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Parks the shared title/text/url and files in a cache, then opens the planner,
// which picks them up and starts reading the recipe.
async function receiveShare(request) {
  const formData = await request.formData();
  const cache = await caches.open(SHARE_CACHE_NAME);
  const files = [];

  for (const [index, file] of formData.getAll("files").entries()) {
    if (!(file instanceof File)) continue;
    const key = `/__share-target/file-${index}`;
    await cache.put(key, new Response(file, { headers: { "Content-Type": file.type } }));
    files.push({ key, name: file.name, type: file.type });
  }

  const meta = {
    title: formData.get("title") || "",
    text: formData.get("text") || "",
    url: formData.get("url") || "",
    files,
  };

  await cache.put(
    "/__share-target/meta",
    new Response(JSON.stringify(meta), { headers: { "Content-Type": "application/json" } }),
  );

  return Response.redirect("/meal-planner?shared=1", 303);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    event.request.method === "POST" &&
    url.origin === self.location.origin &&
    url.pathname === "/share-target"
  ) {
    event.respondWith(receiveShare(event.request));
    return;
  }

  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/_next/static/")
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }),
  );
});
